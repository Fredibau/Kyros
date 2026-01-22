// apps/web/src/app/auth/login/page.tsx
"use client";

import LoginButtons from "@/app/auth/LoginButtons";

export default function LoginPage() {
  return (
    <div className="text-center">
      <div className="mb-10 flex flex-col items-center">
        <div className="mb-5 flex items-center justify-center w-18 h-18 rounded-2xl bg-linear-to-br from-cyan-300 to-cyan-500 shadow-[0_0_30px_rgba(56,189,248,0.45)]">
          <span className="text-2xl font-semibold text-slate-900">K</span>
        </div>
        <h1 className="text-4xl font-semibold tracking-tight text-white">Kyros</h1>
        <p className="mt-2 text-sm text-slate-400 max-w-xs">
          Your fintech platform to manage your finances
        </p>
      </div>

      <LoginButtons />
    </div>
  );
}