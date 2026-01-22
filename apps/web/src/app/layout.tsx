// apps/web/src/app/layout.tsx
import type { Metadata } from "next";
import Providers from "./providers";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Soroban Vault",
  description: "Stellar Soroban Smart Contract Vault",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
