// apps/web/src/app/dashboard/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Buffer } from "buffer";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

interface BankAccount {
  account_id: string;
  account_number: {
    iban: string;
    number: string;
  };
  display_name: string;
  currency: string;
  account_type: string;
}

import { startAuthentication } from "@simplewebauthn/browser";
import { buildPrfInput, decryptSecret, extractPrfBytes, toArrayBuffer } from "@/lib/seedless/crypto";
// Import SDK directly from the main package to ensure we use the latest version with all methods
import { 
  Keypair, 
  TransactionBuilder, 
  Operation, 
  Asset, 
  Networks, 
  Horizon,
  hash
} from "@stellar/stellar-sdk";
import { 
  Client, 
  networks, 
} from "vault";

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
  
  // User & Session State
  const [userId, setUserId] = useState<string | null>(null);
  const [authMethod, setAuthMethod] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  
  // Vault & Asset State (EURC)
  const [vaultBalance, setVaultBalance] = useState<bigint>(BigInt(0));
  const [walletBalanceTestnet, setWalletBalanceTestnet] = useState<string>("0");
  const [walletBalanceMainnet, setWalletBalanceMainnet] = useState<string>("0");
  const [decryptedSecret, setDecryptedSecret] = useState<string | null>(null);
  const [stellarAddress, setStellarAddress] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>("");
  
  // Bank State
  const [bankConnected, setBankConnected] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [taxLiability, setTaxLiability] = useState<number>(0);
  const [bankTotalBalance, setBankTotalBalance] = useState<number>(0);
  
  // UI State
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [isFunding, setIsFunding] = useState(false);

  const client = new Client({
    ...networks.testnet,
    rpcUrl: "https://soroban-testnet.stellar.org",
  });

  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (sessionStatus === "unauthenticated") {
      router.push("/");
      return;
    }

    const sessionUser = session?.user as any;
    const sessionUserId = sessionUser?.id ?? null;
    const sessionWallet = sessionUser?.walletAddress ?? null;
    const sessionEmail = sessionUser?.email ?? null;
    const sessionAuthMethod = sessionUser?.authMethod ?? null;

    if (sessionAuthMethod) setAuthMethod(sessionAuthMethod);
    if (sessionUserId) setUserId(sessionUserId);
    if (sessionWallet) setStellarAddress(sessionWallet);
    if (sessionEmail) setUserEmail(sessionEmail);

    const params = new URLSearchParams(window.location.search);
    const userIdParam = params.get("userId");
    const walletAddressParam = params.get("walletAddress");
    const bankConnectedParam = params.get("bank_connected");

    if (userIdParam) setUserId(userIdParam);
    if (walletAddressParam) setStellarAddress(walletAddressParam);
    
    // 2. Load Bank Data if identified
    // Combine all identification sources
    const finalUserId = userIdParam || sessionUserId || undefined;
    const finalWallet = walletAddressParam || sessionWallet || undefined;
    const identification = finalUserId || finalWallet;
    
    if (bankConnectedParam && identification) {
      setBankConnected(true);
      checkBankConnectionStatus(finalWallet, finalUserId);
    } else if (identification) {
      checkBankConnectionStatus(finalWallet, finalUserId);
    }

    // 3. Load Vault Balance if we have a stellar address
    if (walletAddressParam || sessionWallet) {
      const targetAddress = walletAddressParam || sessionWallet || "";
      fetchVaultBalance(targetAddress);
      fetchMainnetBalance(targetAddress);
    }
  }, [router, session, sessionStatus]);

  if (sessionStatus === "loading") {
    return null;
  }

  if (sessionStatus === "unauthenticated") {
    return null;
  }

  const decryptSeedlessKey = async (targetUserId: string) => {
    const optionsRes = await fetch(`${apiBase}/auth/passkey/generate-authentication`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: targetUserId }),
    });
    const options = await optionsRes.json();
    if (options.error) throw new Error(options.error);

    const prfInput = await buildPrfInput();
    options.extensions = {
      ...(options.extensions || {}),
      prf: { eval: { first: toArrayBuffer(prfInput) } },
    };

    const authResp = await startAuthentication({ optionsJSON: options });

    const verifyRes = await fetch(`${apiBase}/auth/passkey/verify-authentication`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: targetUserId,
        body: authResp,
        currentChallenge: options.challenge,
      }),
    });

    const verifyData = await verifyRes.json();
    if (!verifyData.success) throw new Error("Biometric authorization failed");

    const prfBytes = extractPrfBytes(authResp);
    if (!prfBytes) {
      throw new Error("Passkey PRF not supported on this device");
    }

    const seedlessRes = await fetch(`${apiBase}/wallet/seedless?userId=${targetUserId}`);
    const seedlessData = await seedlessRes.json();
    if (!seedlessRes.ok || seedlessData.error) {
      throw new Error(seedlessData.error || "Seedless wallet not found");
    }

    const decrypted = await decryptSecret(
      seedlessData.encryptedSecret,
      seedlessData.iv,
      prfBytes
    );
    setDecryptedSecret(decrypted);
    return decrypted;
  };

  const fetchVaultBalance = async (address?: string | null) => {
    if (!address) {
      console.warn("Missing wallet address; skipping balance fetch.");
      return;
    }
    try {
      // 1. Fetch Wallet Balance (Testnet Horizon) - Development Only
      const server = new Horizon.Server("https://horizon-testnet.stellar.org");
      const accountData = await server.loadAccount(address);
      const nativeBalance = accountData.balances.find(b => b.asset_type === 'native');
      setWalletBalanceTestnet(nativeBalance?.balance || "0");

      // 2. Fetch Vault Balance (Soroban)
      const NATIVE_XLM = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
      const tx = await client.get_balance({ user: address, token_id: NATIVE_XLM });
      setVaultBalance(tx.result);
    } catch (err: any) {
      const status = err?.response?.status;
      const message = err?.message || "";
      const notFound = status === 404 || /not found/i.test(message);
      if (notFound) {
        setWalletBalanceTestnet("0");
        setVaultBalance(BigInt(0));
        return;
      }
      console.error("Error fetching balance:", err);
    }
  };

  const fetchMainnetBalance = async (address?: string | null) => {
    if (!address) {
      console.warn("Missing wallet address; skipping mainnet balance fetch.");
      return;
    }
    try {
      const server = new Horizon.Server("https://horizon.stellar.org");
      const accountData = await server.loadAccount(address);
      const nativeBalance = accountData.balances.find(b => b.asset_type === "native");
      setWalletBalanceMainnet(nativeBalance?.balance || "0");
    } catch (err: any) {
      const status = err?.response?.status;
      const message = err?.message || "";
      const notFound = status === 404 || /not found/i.test(message);
      if (notFound) {
        setWalletBalanceMainnet("0");
        return;
      }
      console.error("Error fetching mainnet balance:", err);
    }
  };

  const checkBankConnectionStatus = async (walletAddr?: string, uId?: string) => {
    const targetId = uId || userId;
    const targetWallet = walletAddr || stellarAddress;
    
    if (!targetId && !targetWallet) return;

    try {
      const query = targetId ? `userId=${targetId}` : `walletAddress=${targetWallet}`;
      const response = await fetch(`${apiBase}/truelayer/stats?${query}`);
      if (response.ok) {
        const stats = await response.json();
        if (!stats.connected) {
          setBankConnected(false);
          return;
        }

        setBankTotalBalance(stats.totalBalance || 0);
        setTaxLiability(stats.totalTaxLiability || 0);
        setRecentTransactions(stats.transactions || []);
        setBankConnected(true);

        const accRes = await fetch(`${apiBase}/truelayer/accounts?${query}`);
        const accData = await accRes.json();
        if (accData.results) {
          setBankAccounts(accData.results);
        }
      } else {
        setBankConnected(false);
      }
    } catch (err) {
      setBankConnected(false);
    }
  };

  const connectBank = async () => {
    setLoading(true);
    try {
      let query = "state=anonymous";
      if (userId) query = `userId=${userId}`;
      else if (stellarAddress) query = `walletAddress=${stellarAddress}`;
      
      const response = await fetch(`${apiBase}/truelayer/auth?${query}`);
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setStatus("Bank connection failed");
      setLoading(false);
    }
  };

  const disconnectBank = async () => {
    const targetId = userId || stellarAddress;
    if (!targetId) {
      setStatus("No identity found to disconnect");
      return;
    }
    
    setLoading(true);
    try {
      const body = userId ? { userId } : { walletAddress: stellarAddress };
      const response = await fetch(`${apiBase}/truelayer/disconnect`, {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" }
      });
      
      const data = await response.json();
      
      if (response.ok && (data.success || !data.error)) {
        setBankConnected(false);
        setBankAccounts([]);
        setRecentTransactions([]);
        setTaxLiability(0);
        setBankTotalBalance(0);
        setStatus("Bank disconnected successfully");
        
        // Clean up URL if present
        const url = new URL(window.location.href);
        url.searchParams.delete("bank_connected");
        window.history.replaceState({}, "", url.toString());
      } else {
        setStatus(`Failed: ${data.error || data.message || "Unknown error"}`);
      }
    } catch (err: any) {
      setStatus(`Failed to disconnect: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const syncBankData = async () => {
    const targetId = userId || stellarAddress;
    if (!targetId) return;
    
    setLoading(true);
    setStatus("Syncing latest transactions...");
    try {
      const body = userId ? { userId } : { walletAddress: stellarAddress };
      const response = await fetch(`${apiBase}/truelayer/sync`, {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" }
      });
      
      if (response.ok) {
        setStatus("Sync complete!");
        await checkBankConnectionStatus(); // Refresh the UI data
      } else {
        const errorData = await response.json();
        setStatus(`Sync failed: ${errorData.error || "Unknown error"}`);
      }
    } catch (err: any) {
      setStatus(`Sync failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const EURC_TOKEN_ID = "CAU7XST0B5J7A2C5X7A7A7A7A7A7A7A7A7A7A7A7A7A7A7A7A7A7A7"; // Dummy EURC Token Contract ID

  const handleVaultAction = async (action: "deposit" | "withdraw") => {
    if (!stellarAddress || !amount || !userId) return;
    
    setLoading(true);
    setStatus(`${action === "deposit" ? "Securing" : "Withdrawing"} funds...`);
    
    try {
      // 1. Trigger Passkey Signature (Authentication) + decrypt seedless key
      setStatus("Action required: Authorize move to Vault with Passkey...");
      const decryptedSecret = await decryptSeedlessKey(userId);

      // 2. Proceed with Stellar Contract Call
      setStatus("Biometric authorized. Executing on-chain move...");
      
      // XLM and most Stellar tokens use 7 decimals (1 XLM = 10,000,000 stroops)
      if (isNaN(parseFloat(amount))) throw new Error("Invalid amount");
      const amountInt = BigInt(Math.round(parseFloat(amount) * 10_000_000));
      
      const userKp = Keypair.fromSecret(decryptedSecret);
      if (userKp.publicKey() !== stellarAddress) {
        const mismatch = `Wallet mismatch: local key ${userKp.publicKey()} does not match ${stellarAddress}`;
        console.error(mismatch);
        const resetMessage = "Wallet mismatch detected. Resetting session.";
        setStatus(resetMessage);
        await signOut({ callbackUrl: "/" });
        throw new Error(mismatch);
      }

      console.log(`Vault Action: ${action}`, {
        stellarAddress,
        amount: amountInt.toString(),
        contract: client.options.contractId,
      });

      const signTransaction = async (txXdr: string) => {
        const tx = TransactionBuilder.fromXDR(
          txXdr,
          client.options.networkPassphrase || Networks.TESTNET
        );
        tx.sign(userKp);
        return { signedTxXdr: tx.toXDR() };
      };
      const signAuthEntry = async (authEntryXdr: string) => {
        const signature = userKp
          .sign(hash(Buffer.from(authEntryXdr, "base64")))
          .toString("base64");
        return { signedAuthEntry: signature, signerAddress: userKp.publicKey() };
      };

      if (action === "deposit") {
        const NATIVE_XLM = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

        console.log("Simulating deposit...", {
          from: stellarAddress,
          token_id: NATIVE_XLM,
          amount: amountInt,
        });

        const assembled = await client.deposit(
          {
            from: stellarAddress,
            token_id: NATIVE_XLM,
            amount: amountInt,
          },
          {
            fee: "10000",
            publicKey: stellarAddress,
            signTransaction,
          }
        );

        console.log("Deposit simulation result:", assembled.simulation);

        if (assembled.simulation && "error" in assembled.simulation) {
          throw new Error(`Simulation failed: ${assembled.simulation.error}`);
        }

        if (assembled.needsNonInvokerSigningBy().includes(stellarAddress)) {
          await assembled.signAuthEntries({ signAuthEntry, address: stellarAddress });
        }

        const sent = await assembled.signAndSend({ signTransaction });
        console.log("Deposit send result:", sent);
        setStatus("Success! XLM secured in Vault.");
      } else {
        const NATIVE_XLM = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

        console.log("Simulating withdrawal...", {
          to: stellarAddress,
          token_id: NATIVE_XLM,
          amount: amountInt,
        });

        const assembled = await client.withdraw(
          {
            to: stellarAddress,
            token_id: NATIVE_XLM,
            amount: amountInt,
          },
          {
            fee: "10000",
            publicKey: stellarAddress,
            signTransaction,
          }
        );

        console.log("Withdraw simulation result:", assembled.simulation);

        if (assembled.simulation && "error" in assembled.simulation) {
          throw new Error(`Simulation failed: ${assembled.simulation.error}`);
        }

        if (assembled.needsNonInvokerSigningBy().includes(stellarAddress)) {
          await assembled.signAuthEntries({ signAuthEntry, address: stellarAddress });
        }

        const sent = await assembled.signAndSend({ signTransaction });
        console.log("Withdraw send result:", sent);
        setStatus("Withdrawal successful.");
      }
      
      fetchVaultBalance(stellarAddress);
    } catch (err: any) {
      console.error("Vault Action Error:", err);
      // Log stack trace if available
      if (err.stack) console.error(err.stack);
      setStatus(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fundTestnetWallet = async () => {
    if (!stellarAddress) return;
    setIsFunding(true);
    setStatus("Funding testnet wallet via Friendbot...");
    try {
      const response = await fetch(`https://friendbot.stellar.org?addr=${stellarAddress}`);
      if (response.ok) {
        setStatus("Wallet funded! You now have test XLM for fees.");
        fetchVaultBalance(stellarAddress);
      } else {
        setStatus("Funding failed. Try again later.");
      }
    } catch (err) {
      setStatus("Error funding wallet.");
    } finally {
      setIsFunding(false);
    }
  };

  const logout = () => {
    signOut({ callbackUrl: "/" });
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-blue-500/30">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold shadow-lg shadow-blue-500/20">K</div>
            <h1 className="text-xl font-black tracking-tight">KYROS</h1>
          </div>
          <div className="flex items-center gap-4">
            {bankConnected && (
              <button 
                onClick={syncBankData}
                disabled={loading}
                className="text-[10px] bg-blue-600/10 text-blue-400 border border-blue-500/20 px-3 py-1.5 rounded-full hover:bg-blue-600 hover:text-white transition-all font-black uppercase tracking-widest flex items-center gap-2"
              >
                <svg className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
                {loading ? "Syncing..." : "Sync Data"}
              </button>
            )}
            <button 
              onClick={logout}
              className="text-xs text-gray-500 hover:text-white transition-colors uppercase font-bold tracking-widest mr-4"
            >
              Log Out
            </button>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${bankConnected ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
              <div className={`w-2 h-2 rounded-full ${bankConnected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
              {bankConnected ? "Bank Linked" : "Bank Disconnected"}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Column 1: Identity & Connectivity */}
          <div className="space-y-8">
            <section className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-xl">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <span className="text-blue-500">01</span> Account
              </h2>
              <div className="space-y-4">
                <div className="p-4 bg-gray-800 rounded-2xl border border-gray-700">
                  <p className="text-xs text-gray-500 uppercase font-bold mb-1 flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full" />
                    KYROS ID (Email)
                  </p>
                  <p className="font-medium text-sm text-white">{userEmail || "frederik@example.com"}</p>
                  {stellarAddress && (
                    <p className="font-mono text-[10px] text-gray-500 mt-2 truncate">{stellarAddress}</p>
                  )}
                </div>

                {!bankConnected ? (
                  <button onClick={connectBank} className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
                    Connect Bank (TrueLayer)
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div className="p-4 bg-gray-800 rounded-2xl border border-gray-700 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500 uppercase font-bold mb-1">Open Banking</p>
                        <p className="text-sm font-bold text-green-400">Connection Active</p>
                      </div>
                      <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center text-green-500">✓</div>
                    </div>
                    <button 
                      onClick={disconnectBank}
                      disabled={loading}
                      className="w-full py-2 text-xs text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors font-medium"
                    >
                      {loading ? "Disconnecting..." : "Disconnect Bank Account"}
                    </button>
                  </div>
                )}
              </div>
            </section>

            {status && (
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-blue-300 text-sm text-center animate-in fade-in">
                {status}
              </div>
            )}
          </div>

          {/* Column 2: Bank Data & Tax Estimate */}
          <div className="lg:col-span-2 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Bank Balance Card */}
              <section className="bg-gray-900 border border-gray-800 rounded-3xl p-8 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18M3 10h18M5 10v11M9 10v11M13 10v11M17 10v11M2 10l10-8 10 8"/></svg>
                </div>
                <h3 className="text-gray-500 font-bold text-sm uppercase tracking-widest mb-2">Traditional Balance</h3>
                {bankAccounts.length > 0 ? (
                  <div>
                    <p className="text-5xl font-black mb-1">€ {bankTotalBalance.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</p>
                    <p className="text-sm text-gray-400">Across {bankAccounts.length} linked accounts</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-5xl font-black mb-1 text-gray-700">€ 0,00</p>
                    <p className="text-sm text-gray-500">No bank accounts linked</p>
                  </div>
                )}
              </section>

              {/* Tax Liability Card */}
              <section className="bg-linear-to-br from-blue-900/40 to-black border border-blue-500/30 rounded-3xl p-8 shadow-[0_0_40px_-15px_rgba(59,130,246,0.3)]">
                <h3 className="text-blue-400 font-bold text-sm uppercase tracking-widest mb-2">Estimated Tax (21%)</h3>
                <p className="text-5xl font-black text-white mb-1">
                  € {taxLiability.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                </p>
                <div className="flex items-center gap-2 mt-2">
                </div>
              </section>
            </div>

            {/* Vault */}
            <section className="bg-gray-900 border border-gray-800 rounded-3xl p-8 shadow-2xl">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-black italic tracking-tighter">Vault</h2>
                  <p className="text-gray-500 text-sm font-medium">Securely holds your funds</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-black/50 p-6 rounded-2xl border border-gray-800 shadow-inner">
                  <p className="text-gray-500 text-xs mb-1 font-bold uppercase tracking-widest">Vault Balance (EURC)</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-white">{vaultBalance.toString()}</span>
                    <span className="text-gray-600 font-bold text-sm uppercase">Units</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="Amount to secure"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full bg-black border border-gray-700 rounded-2xl py-4 px-6 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-gray-800"
                    />
                    <button 
                      onClick={() => setAmount(taxLiability.toFixed(2))}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] bg-blue-600/20 text-blue-400 px-2 py-1 rounded-lg font-black hover:bg-blue-600 hover:text-white transition-colors uppercase tracking-tighter"
                    >
                      Use Tax Amount
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => handleVaultAction("deposit")}
                      disabled={loading}
                      className="bg-green-600 hover:bg-green-700 disabled:opacity-30 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-green-900/20 uppercase text-xs tracking-widest"
                    >
                      Secure Funds
                    </button>
                    <button 
                      onClick={() => handleVaultAction("withdraw")}
                      disabled={loading}
                      className="bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-white font-black py-4 rounded-2xl transition-all uppercase text-xs tracking-widest"
                    >
                      Withdraw
                    </button>
                  </div>
                </div>
              </div>
            </section>
            
            {/* Development Only: Local Wallet Balance + Seedless Key */}
            <section className="bg-gray-900/50 border border-gray-800/50 rounded-3xl p-6 shadow-sm border-dashed">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <div className="px-2 py-0.5 bg-yellow-500/10 text-yellow-500 text-[8px] font-black uppercase tracking-widest rounded border border-yellow-500/20">
                    Dev Only
                  </div>
                  <h3 className="text-gray-400 font-bold text-xs uppercase tracking-widest">On-Chain Wallet (XLM Testnet)</h3>
                </div>
                <button 
                  onClick={() => {
                    fetchVaultBalance(stellarAddress);
                    fetchMainnetBalance(stellarAddress);
                  }}
                  disabled={!stellarAddress}
                  className="text-[10px] text-gray-600 hover:text-blue-400 disabled:text-gray-700 disabled:cursor-not-allowed transition-colors uppercase font-bold"
                >
                  Refresh
                </button>
              </div>
              <button 
                onClick={fundTestnetWallet}
                disabled={isFunding}
                className="w-full mb-4 bg-gray-800 text-blue-400 border border-blue-500/20 py-2 rounded-xl hover:bg-gray-700 transition-all text-xs font-bold flex items-center justify-center gap-2"
              >
                {isFunding ? "Funding..." : "Get Test XLM (Friendbot)"}
              </button>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-gray-300">{Number(walletBalanceTestnet).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                <span className="text-gray-600 font-bold text-xs uppercase">XLM</span>
              </div>
              <p className="text-[9px] text-gray-600 mt-2 leading-tight italic">
                This shows the funds currently held in your landing pad wallet on testnet.
              </p>
              <div className="mt-4 pt-4 border-t border-gray-800">
                <p className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-2">
                  Mainnet Balance (XLM)
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-gray-300">
                    {Number(walletBalanceMainnet).toLocaleString("de-DE", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                  <span className="text-gray-600 font-bold text-xs uppercase">XLM</span>
                </div>
                <p className="text-[9px] text-gray-600 mt-2 leading-tight italic">
                  Mainnet balance for the same address.
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-800">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-[9px] text-gray-500 uppercase font-bold tracking-widest">
                    Decrypted Seedless Key (Dev)
                  </p>
                  <button
                    onClick={() => userId && decryptSeedlessKey(userId)}
                    className="text-[10px] text-gray-600 hover:text-blue-400 transition-colors uppercase font-bold"
                  >
                    Decrypt
                  </button>
                </div>
                <p className="font-mono text-[10px] text-gray-400 break-all">
                  {decryptedSecret || "Not decrypted yet"}
                </p>
              </div>
            </section>
          </div>
        </div>

        {/* Transactions Section */}
        {bankConnected && (
          <section className="mt-12 bg-gray-900 border border-gray-800 rounded-3xl p-8 shadow-xl">
            <h2 className="text-2xl font-black mb-6 flex items-center gap-3 italic">
              <span className="text-blue-500 text-[10px] font-black border border-blue-500/30 px-2 py-1 rounded uppercase tracking-[0.2em] not-italic">Detection</span>
              Recent Income & Tax Events
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-gray-500 text-[10px] uppercase font-black tracking-widest border-b border-gray-800">
                    <th className="pb-4">Date</th>
                    <th className="pb-4">Description</th>
                    <th className="pb-4 text-right">Amount</th>
                    <th className="pb-4 text-right">Tax (21%)</th>
                    <th className="pb-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {recentTransactions.length > 0 ? (
                    recentTransactions.map((tx) => (
                      <tr key={tx.id} className="group hover:bg-gray-800/30 transition-colors">
                        <td className="py-4 text-sm text-gray-400 font-mono">
                          {new Date(tx.timestamp).toLocaleDateString('de-DE')}
                        </td>
                        <td className="py-4 font-bold text-sm">{tx.description}</td>
                        <td className={`py-4 text-right font-black ${tx.amount > 0 ? "text-green-400" : "text-gray-400"}`}>
                          € {Number(tx.amount).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-4 text-right text-blue-400 font-black">
                          {tx.taxAmount ? `€ ${Number(tx.taxAmount).toLocaleString('de-DE', { minimumFractionDigits: 2 })}` : "-"}
                        </td>
                        <td className="py-4 text-center">
                          {tx.taxAmount ? (
                            <span className="text-[9px] bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full font-black tracking-widest uppercase">Detected</span>
                          ) : (
                            <span className="text-[9px] bg-gray-800 text-gray-500 px-2 py-1 rounded-full font-bold uppercase tracking-widest">Ignored</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-gray-600 italic font-medium">
                        No income events detected yet. Try syncing again or check another account.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
