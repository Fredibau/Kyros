import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

type SeedlessPayload = {
  userId?: string;
  walletAddress?: string;
  encryptedSecret?: string;
  iv?: string;
  version?: string;
};

export async function walletSeedlessRoutes(app: FastifyInstance) {
  app.post("/wallet/seedless", async (request, reply) => {
    const { userId, walletAddress, encryptedSecret, iv, version } =
      request.body as SeedlessPayload;

    if (!userId || !walletAddress || !encryptedSecret || !iv || !version) {
      return reply.code(400).send({ error: "Missing required data" });
    }

    const wallet = await prisma.wallet.upsert({
      where: { address: walletAddress },
      update: {
        userId,
        provider: "seedless-passkey",
        encryptedSecret,
        encryptionIv: iv,
        encryptionVersion: version,
      },
      create: {
        userId,
        address: walletAddress,
        provider: "seedless-passkey",
        encryptedSecret,
        encryptionIv: iv,
        encryptionVersion: version,
      },
    });

    return reply.send({ success: true, walletAddress: wallet.address });
  });

  app.get("/wallet/seedless", async (request, reply) => {
    const { userId } = request.query as { userId?: string };

    if (!userId) {
      return reply.code(400).send({ error: "User ID is required" });
    }

    const wallet = await prisma.wallet.findFirst({
      where: { userId, provider: "seedless-passkey" },
      orderBy: { createdAt: "desc" },
    });

    if (!wallet?.encryptedSecret || !wallet.encryptionIv) {
      return reply.code(404).send({ error: "Seedless wallet not found" });
    }

    return reply.send({
      walletAddress: wallet.address,
      encryptedSecret: wallet.encryptedSecret,
      iv: wallet.encryptionIv,
      version: wallet.encryptionVersion,
    });
  });
}

