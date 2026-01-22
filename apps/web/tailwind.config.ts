import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
  './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  './src/hooks/**/*.{ts,tsx}',
    './src/lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        cyan: {
          '400': '#00d4ff',
          '300': '#33e0ff',
          '500': '#00bfff',
        },
      },
    },
  },
  plugins: [],
}
export default config

    
// import type { Config } from 'tailwindcss'

// const config: Config = {
//   content: [
//     './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
//     './src/components/**/*.{js,ts,jsx,tsx,mdx}',
//     './src/app/**/*.{js,ts,jsx,tsx,mdx}',
//   ],
//   theme: {
//     extend: {
//       colors: {
//         cyan: {
//           '300': '#33e0ff',
//           '400': '#00d4ff',
//           '500': '#00bfff',
//         },
//         gray: {
//           '50': '#f9fafb',
//           '100': '#f3f4f6',
//           '200': '#e5e7eb',
//           '300': '#d1d5db',
//           '400': '#9ca3af',
//           '500': '#6b7280',
//           '600': '#4b5563',
//           '700': '#374151',
//           '800': '#1f2937',
//           '900': '#111827',
//           '950': '#0a0f1f',
//         },
//       },
//     },
//   },
//   plugins: [],
// }
// export default config

// import type { Config } from 'tailwindcss'

// const config: Config = {
//   content: [
//     './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
//     './src/components/**/*.{js,ts,jsx,tsx,mdx}',
//     './src/app/**/*.{js,ts,jsx,tsx,mdx}',
//   ],
//   theme: {
//     extend: {
//       colors: {
//         cyan: {
//           '400': '#00d4ff',
//           '300': '#33e0ff',
//           '500': '#00bfff',
//         },
//       },
//     },
//   },
//   plugins: [],
// }
// export default config