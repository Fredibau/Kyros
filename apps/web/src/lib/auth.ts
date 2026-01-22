import type { NextAuthOptions, Session, User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

const fetchWalletAddress = async (userId?: string | null) => {
  if (!userId) return null;
  try {
    const response = await fetch(
      `${apiBase}/wallet/seedless?userId=${encodeURIComponent(userId)}`,
      { cache: "no-store" },
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data?.walletAddress ?? null;
  } catch {
    return null;
  }
};

type PasskeyCredentials = {
  userId?: string;
  email?: string;
  body?: string;
  currentChallenge?: string;
};

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      id: "passkey",
      name: "Passkey",
      credentials: {
        userId: { label: "User ID", type: "text" },
        email: { label: "Email", type: "email" },
        body: { label: "Auth Response", type: "text" },
        currentChallenge: { label: "Challenge", type: "text" },
      },
      authorize: async (credentials: PasskeyCredentials | undefined) => {
        if (!credentials?.body || !credentials?.currentChallenge) {
          return null;
        }

        const authBody =
          typeof credentials.body === "string"
            ? JSON.parse(credentials.body)
            : credentials.body;

        const response = await fetch(`${apiBase}/auth/passkey/verify-authentication`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: credentials.userId,
            body: authBody,
            currentChallenge: credentials.currentChallenge,
          }),
        });

        const data = await response.json();
        if (!response.ok || data?.error || !data?.success) {
          return null;
        }

        return {
          id: data.userId,
          email: data.email ?? credentials.email ?? null,
          name: data.email ?? credentials.email ?? undefined,
          walletAddress: data.walletAddress ?? null,
          authMethod: "passkey",
        } as any;
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }: { token: JWT; user?: User | null }) => {
      if (user) {
        token.userId = (user as any).id;
        token.walletAddress = (user as any).walletAddress ?? null;
        token.authMethod = (user as any).authMethod ?? "passkey";
      }
      if (!token.walletAddress && token.userId) {
        const walletAddress = await fetchWalletAddress(token.userId as string);
        token.walletAddress = walletAddress ?? null;
      }
      return token;
    },
    session: async ({ session, token }: { session: Session; token: JWT }) => {
      if (session.user) {
        (session.user as any).id = token.userId;
        (session.user as any).walletAddress = token.walletAddress ?? null;
        (session.user as any).authMethod = token.authMethod ?? "passkey";
      }
      return session;
    },
  },
};

