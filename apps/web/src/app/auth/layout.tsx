//apps/web/src/app/auth/layout.tsx
// import React from 'react';

// export default function AuthLayout({
//   children,
// }: {
//   children: React.ReactNode;
// }) {
//   return (
//     <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#050B1E] to-[#020617]">
//       <div className="w-full max-w-md px-6">
//         {children}
//       </div>
//     </div>
//   );
// }

import '@/styles/globals.css';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#050b2c] via-[#050b2c] to-black px-4">
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-10 shadow-2xl">
        {children}
      </div>
    </div>
  );
}

