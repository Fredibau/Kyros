import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import {
  getAccountBalance,
  getAccounts,
  getExchangeToken,
  getTransactions,
} from "../lib/truelayer/client.js";

export async function truelayerRoutes(app: FastifyInstance) {
  app.get("/truelayer/auth", async (request, reply) => {
    const { walletAddress } = request.query as { walletAddress?: string };

    const clientId = process.env.TRUELAYER_CLIENT_ID;
    const redirectUri = process.env.TRUELAYER_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return reply.code(500).send({ error: "TrueLayer configuration missing" });
    }

    const scopes =
      "info accounts balance cards transactions direct_debits standing_orders offline_access";
    const providers = "uk-cs-mock uk-ob-all uk-oauth-all";
    const state = walletAddress || "anonymous";

    const authUrl =
      "https://auth.truelayer-sandbox.com/?response_type=code" +
      `&client_id=${clientId}` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&providers=${encodeURIComponent(providers)}` +
      `&state=${encodeURIComponent(state)}` +
      "&response_mode=query";

    return reply.send({ url: authUrl });
  });

  app.get("/truelayer/callback", async (request, reply) => {
    const { code, state } = request.query as {
      code?: string;
      state?: string;
    };

    if (!code) {
      return reply.code(400).send({ error: "No code received" });
    }

    try {
      const tokens = await getExchangeToken(code);
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + (tokens.expires_in || 3600));

      let userId: string;

      if (state && state !== "anonymous") {
        const dbWallet = await prisma.wallet.findUnique({
          where: { address: state },
          include: { user: true },
        });

        if (dbWallet) {
          userId = dbWallet.userId;
        } else {
          const newUser = await prisma.user.create({
            data: {
              wallets: {
                create: { address: state, provider: "seedless-passkey" },
              },
            },
          });
          userId = newUser.id;
        }
      } else {
        const newUser = await prisma.user.create({ data: {} });
        userId = newUser.id;
      }

      await prisma.trueLayerConnection.upsert({
        where: { id: userId },
        update: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt,
        },
        create: {
          id: userId,
          userId,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt,
        },
      });

      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
      const redirectUrl =
        `${baseUrl}/dashboard?bank_connected=true&userId=${userId}` +
        (state && state !== "anonymous" ? `&walletAddress=${state}` : "");

      return reply.redirect(303, redirectUrl);
    } catch (error: any) {
      app.log.error("TrueLayer Callback Error:", error);
      return reply.code(500).send({ error: error.message });
    }
  });

  app.post("/truelayer/disconnect", async (request, reply) => {
    try {
      const { walletAddress, userId } = request.body as {
        walletAddress?: string;
        userId?: string;
      };

      let user;

      if (userId) {
        user = await prisma.user.findUnique({
          where: { id: userId },
          include: { connections: true },
        });
      } else if (walletAddress) {
        const wallet = await prisma.wallet.findUnique({
          where: { address: walletAddress },
          include: { user: { include: { connections: true } } },
        });
        user = wallet?.user;
      }

      if (!user) {
        return reply.code(404).send({ error: "User not found" });
      }

      if (!user.connections || user.connections.length === 0) {
        return reply.send({
          success: true,
          message: "No active connection found",
        });
      }

      await prisma.trueLayerConnection.deleteMany({
        where: { userId: user.id },
      });

      return reply.send({ success: true, message: "Bank connection removed" });
    } catch (error: any) {
      app.log.error("Disconnect Error:", error);
      return reply.code(500).send({ error: error.message });
    }
  });

  app.get("/truelayer/stats", async (request, reply) => {
    try {
      const { walletAddress, userId } = request.query as {
        walletAddress?: string;
        userId?: string;
      };

      let user;

      if (userId) {
        user = await prisma.user.findUnique({
          where: { id: userId },
          include: {
            connections: {
              include: {
                accounts: {
                  include: {
                    transactions: true,
                  },
                },
              },
            },
          },
        });
      } else if (walletAddress) {
        const wallet = await prisma.wallet.findUnique({
          where: { address: walletAddress },
          include: {
            user: {
              include: {
                connections: {
                  include: {
                    accounts: {
                      include: {
                        transactions: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });
        user = wallet?.user;
      }

      if (!user) {
        return reply.code(404).send({ error: "User not found" });
      }

      if (!user.connections || user.connections.length === 0) {
        return reply.send({
          connected: false,
          totalBalance: 0,
          totalTaxLiability: 0,
          transactions: [],
          accountCount: 0,
        });
      }

      let totalBalance = 0;
      let totalTaxLiability = 0;
      const allTransactions: any[] = [];

      await Promise.all(
        user.connections.map(async (conn) => {
          await Promise.all(
            conn.accounts.map(async (acc) => {
              try {
                const balanceData = await getAccountBalance(
                  conn.accessToken,
                  acc.trueLayerAccountId,
                );
                if (balanceData.results && balanceData.results.length > 0) {
                  totalBalance += balanceData.results[0].current;
                }
              } catch (err) {
                app.log.error(
                  `Failed to fetch balance for account ${acc.trueLayerAccountId}`,
                  err,
                );
              }

              acc.transactions.forEach((tx) => {
                if (tx.taxCalculated && tx.taxAmount) {
                  totalTaxLiability += Number(tx.taxAmount);
                }
                allTransactions.push(tx);
              });
            }),
          );
        }),
      );

      allTransactions.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      return reply.send({
        connected: true,
        totalBalance,
        totalTaxLiability,
        transactions: allTransactions.slice(0, 10),
        accountCount: user.connections.reduce(
          (sum, conn) => sum + conn.accounts.length,
          0,
        ),
      });
    } catch (error: any) {
      app.log.error("Stats Error:", error);
      return reply.code(500).send({ error: error.message });
    }
  });

  app.post("/truelayer/sync", async (request, reply) => {
    try {
      const { walletAddress, userId } = request.body as {
        walletAddress?: string;
        userId?: string;
      };

      if (!walletAddress && !userId) {
        return reply
          .code(400)
          .send({ error: "walletAddress or userId is required" });
      }

      let user;
      if (userId) {
        user = await prisma.user.findUnique({
          where: { id: userId },
          include: { connections: true },
        });
      } else if (walletAddress) {
        const wallet = await prisma.wallet.findUnique({
          where: { address: walletAddress },
          include: { user: { include: { connections: true } } },
        });
        user = wallet?.user;
      }

      const connection = user?.connections[0];

      if (!connection) {
        return reply
          .code(404)
          .send({ error: "No bank connection found for this user" });
      }

      const accountsData = await getAccounts(connection.accessToken);

      const syncResults = await Promise.all(
        accountsData.results.map(async (remoteAccount: any) => {
          const dbAccount = await prisma.bankAccount.upsert({
            where: { trueLayerAccountId: remoteAccount.account_id },
            update: {
              displayName: remoteAccount.display_name,
              currency: remoteAccount.currency,
              iban: remoteAccount.account_number?.iban,
            },
            create: {
              connectionId: connection.id,
              trueLayerAccountId: remoteAccount.account_id,
              displayName: remoteAccount.display_name,
              currency: remoteAccount.currency,
              iban: remoteAccount.account_number?.iban,
            },
          });

          const transactionsData = await getTransactions(
            connection.accessToken,
            remoteAccount.account_id,
          );

          const taxRate = 0.21;
          let taxCalculatedTotal = 0;
          let newTransactionsCount = 0;

          const remoteTxIds = transactionsData.results.map(
            (tx: any) => tx.transaction_id,
          );
          const existingTxs = await prisma.transaction.findMany({
            where: { trueLayerId: { in: remoteTxIds } },
            select: { trueLayerId: true },
          });
          const existingTxIds = new Set(
            existingTxs.map((tx) => tx.trueLayerId),
          );

          const newTransactionsData = transactionsData.results
            .filter((remoteTx: any) => !existingTxIds.has(remoteTx.transaction_id))
            .map((remoteTx: any) => {
              const amount = parseFloat(remoteTx.amount);
              const isIncome = amount > 0;
              const taxAmount = isIncome ? amount * taxRate : 0;

              if (isIncome) taxCalculatedTotal += taxAmount;
              newTransactionsCount++;

              return {
                bankAccountId: dbAccount.id,
                trueLayerId: remoteTx.transaction_id,
                amount,
                currency: remoteTx.currency,
                description: remoteTx.description,
                timestamp: new Date(remoteTx.timestamp),
                taxCalculated: isIncome,
                taxAmount,
              };
            });

          if (newTransactionsData.length > 0) {
            await prisma.transaction.createMany({
              data: newTransactionsData,
              skipDuplicates: true,
            });
          }

          return {
            account: remoteAccount.display_name,
            transactionsSynced: newTransactionsCount,
            taxEstimated: taxCalculatedTotal,
          };
        }),
      );

      return reply.send({ success: true, summary: syncResults });
    } catch (error: any) {
      app.log.error("Sync Error:", error);
      return reply.code(500).send({ error: error.message });
    }
  });

  app.get("/truelayer/accounts", async (request, reply) => {
    try {
      const { walletAddress, userId } = request.query as {
        walletAddress?: string;
        userId?: string;
      };

      if (!walletAddress && !userId) {
        return reply
          .code(400)
          .send({ error: "walletAddress or userId is required" });
      }

      let user;

      if (userId) {
        user = await prisma.user.findUnique({
          where: { id: userId },
          include: { connections: true },
        });
      } else if (walletAddress) {
        const wallet = await prisma.wallet.findUnique({
          where: { address: walletAddress },
          include: { user: { include: { connections: true } } },
        });
        user = wallet?.user;
      }

      const connection = user?.connections[0];

      if (!connection) {
        return reply.code(404).send({ error: "No bank connection found" });
      }

      if (new Date() > connection.expiresAt) {
        return reply.code(401).send({ error: "Token expired, please reconnect" });
      }

      const data = await getAccounts(connection.accessToken);
      return reply.send(data);
    } catch (error: any) {
      app.log.error("Fetch Accounts Error:", error);
      return reply.code(500).send({ error: error.message });
    }
  });
}

