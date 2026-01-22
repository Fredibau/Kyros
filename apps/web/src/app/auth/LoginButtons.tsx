// apps/web/src/components/auth/LoginButtons.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";

import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { Keypair } from "@stellar/stellar-sdk";
import { buildPrfInput, encryptSecret, extractPrfBytes, toArrayBuffer } from "@/lib/seedless/crypto";

export default function LoginButtons() {
  const router = useRouter();
  const { status } = useSession();
  const [loading, setLoading] = useState(false);
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

  const [email, setEmail] = useState("");
  const [authMode, setAuthMode] = useState<"signup" | "login" | null>(null);

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/dashboard");
    }
  }, [status, router]);

  const handleSeedlessLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setLoading(true);
    try {
      // 1. Get registration options from server
      const optionsRes = await fetch(`${apiBase}/auth/passkey/generate-registration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const options = await optionsRes.json();

      if (options.error) throw new Error(options.error);

      // 2. Trigger Passkey creation on the device
      const attResp = await startRegistration({ optionsJSON: options });

      // 3. Verify registration on server
      const verifyRes = await fetch(`${apiBase}/auth/passkey/verify-registration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email, 
          body: attResp,
          currentChallenge: options.challenge 
        }),
      });

      const data = await verifyRes.json();

      if (data.success) {
        const needsSeedlessWallet = !data.walletAddress;

        // --- PASSKEY AUTH FOR SESSION (AND OPTIONAL PRF) ---
        const authOptionsRes = await fetch(`${apiBase}/auth/passkey/generate-authentication`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: data.userId }),
        });
        const authOptions = await authOptionsRes.json();
        if (authOptions.error) throw new Error(authOptions.error);

        if (needsSeedlessWallet) {
          const prfInput = await buildPrfInput();
          authOptions.extensions = {
            ...(authOptions.extensions || {}),
            prf: { eval: { first: toArrayBuffer(prfInput) } },
          };
        }

        const authResp = await startAuthentication({ optionsJSON: authOptions });
        const signInResult = await signIn("passkey", {
          redirect: false,
          userId: data.userId,
          email: data.email ?? email,
          body: JSON.stringify(authResp),
          currentChallenge: authOptions.challenge,
        });

        if (!signInResult?.ok) {
          throw new Error(signInResult?.error || "Passkey verification failed");
        }

        if (needsSeedlessWallet) {
          // --- NON-CUSTODIAL IDENTITY KEY GENERATION ---
          // We generate a key locally and encrypt it using passkey-derived PRF bytes.
          const localKp = Keypair.random();
          const prfBytes = extractPrfBytes(authResp);
          if (!prfBytes) {
            throw new Error("Passkey PRF not supported on this device");
          }

          const encrypted = await encryptSecret(localKp.secret(), prfBytes);
          const storeRes = await fetch(`${apiBase}/wallet/seedless`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: data.userId,
              walletAddress: localKp.publicKey(),
              encryptedSecret: encrypted.encryptedSecret,
              iv: encrypted.iv,
              version: encrypted.version,
            }),
          });
          const storeData = await storeRes.json();
          if (!storeRes.ok || storeData.error) {
            throw new Error(storeData.error || "Failed to store encrypted key");
          }
        }
        router.push("/dashboard");
      } else {
        alert(data.error || "Passkey registration failed");
      }
    } catch (e: any) {
      console.error("Passkey failed", e);
      alert(`Passkey error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      const optionsRes = await fetch(`${apiBase}/auth/passkey/generate-authentication`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const options = await optionsRes.json();

      if (!optionsRes.ok) {
        const message =
          options?.error || `Failed to load passkey options (${optionsRes.status})`;
        alert(message);
        return;
      }

      if (options.error) {
        alert(options.error);
        return;
      }

      if (!options.userId) {
        alert("User not found");
        return;
      }

      const authResp = await startAuthentication({ optionsJSON: options });
      const signInResult = await signIn("passkey", {
        redirect: false,
        userId: options.userId,
        email: options.email ?? email,
        body: JSON.stringify(authResp),
        currentChallenge: options.challenge,
      });

      if (!signInResult?.ok) {
        throw new Error(signInResult?.error || "Login failed");
      }

      router.push("/dashboard");
    } catch (e: any) {
      console.error("Passkey login failed", e);
      alert(`Passkey login error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      {!authMode ? (
        <>
          <button
            onClick={() => setAuthMode("signup")}
            disabled={loading}
            className="w-full bg-white text-black font-black py-4 rounded-2xl hover:bg-gray-200 transition-all shadow-xl flex items-center justify-center gap-3 group"
          >
            <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-[10px] text-white group-hover:scale-110 transition-transform">
              K
            </div>
            Continue with Email
          </button>
          <button
            onClick={() => setAuthMode("login")}
            disabled={loading}
            className="w-full border border-gray-800 text-white font-bold py-4 rounded-2xl hover:border-gray-700 transition-all shadow-xl"
          >
            Log in with Passkey
          </button>
        </>
      ) : (
        <form
          onSubmit={authMode === "login" ? handlePasskeyLogin : handleSeedlessLogin}
          className="space-y-3 animate-in fade-in slide-in-from-top-2"
        >
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-gray-900 border border-gray-800 rounded-2xl py-4 px-6 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            required
            autoFocus
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl hover:bg-blue-700 transition-all shadow-xl disabled:opacity-50"
          >
            {loading
              ? authMode === "login"
                ? "Signing In..."
                : "Creating Wallet..."
              : authMode === "login"
                ? "Sign In"
                : "Secure My Tax Account"}
          </button>
          <button
            type="button"
            onClick={() => setAuthMode(null)}
            className="w-full text-xs text-gray-500 hover:text-white transition-colors uppercase font-bold tracking-widest"
          >
            Back
          </button>
        </form>
      )}

      <p className="text-[10px] text-gray-500 mt-2">
        By continuing, you agree to our Terms of Service.
      </p>
    </div>
  );
}

