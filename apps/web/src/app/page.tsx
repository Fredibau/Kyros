//apps/web/src/app/page.tsx
// import Image from "next/image";
// import Link from "next/image";
import LoginButtons from "@/app/auth/LoginButtons";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black text-white font-sans selection:bg-blue-500/30 overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops))] from-blue-900/20 via-black to-black -z-10" />
      
      <main className="flex flex-col items-center gap-12 p-6 max-w-4xl w-full text-center relative">
        {/* Logo/Brand */}
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <div className="bg-blue-600 w-16 h-16 rounded-3xl flex items-center justify-center font-black text-3xl mx-auto shadow-2xl shadow-blue-500/40">
            K
          </div>
          <h2 className="text-blue-500 font-mono text-sm font-bold uppercase tracking-[0.3em]">
            Project Kairos
          </h2>
        </div>

        {/* Hero Text */}
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-none">
            TAXES INTO <br />
            <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-400 to-blue-600 italic">PROFIT.</span>
          </h1>
          <p className="text-gray-400 text-lg md:text-xl max-w-xl mx-auto leading-relaxed">
            Automated tax withholding for freelancers powered by Stellar. 
            Connect your bank, secure your VAT, and earn yield.
          </p>
        </div>

        {/* Authentication Section */}
        <div className="w-full max-w-sm mx-auto space-y-4 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-500">
          <LoginButtons />
          
          <p className="text-xs text-gray-600 font-medium">
            Secure, non-custodial onboarding
          </p>
        </div>

        {/* Features Preview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full mt-12 pt-12 border-t border-gray-900 animate-in fade-in duration-1000 delay-700">
          <div className="p-4">
            <h3 className="font-bold text-white mb-1">Open Banking</h3>
            <p className="text-sm text-gray-500">Real-time income detection.</p>
          </div>
          <div className="p-4">
            <h3 className="font-bold text-white mb-1">Soroban Vault</h3>
            <p className="text-sm text-gray-500">Smart-contract based yield generation.</p>
          </div>
          <div className="p-4">
            <h3 className="font-bold text-white mb-1">Non-Custodial</h3>
            <p className="text-sm text-gray-500">You always keep 100% control of your funds.</p>
          </div>
        </div>
      </main>

      <footer className="mt-auto py-8 text-gray-700 text-[10px] font-mono uppercase tracking-widest">
        Stellar Community Fund #41 | MVP Phase 1.0
      </footer>
    </div>
  );
}
