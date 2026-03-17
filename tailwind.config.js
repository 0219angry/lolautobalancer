/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas:  '#08090c',
        surface: '#0f1218',
        raised:  '#141820',
        wire: {
          DEFAULT: '#1e2530',
          bright:  '#2e3d4e',
        },
        ink: {
          DEFAULT: '#ddd6c4',
          dim:     '#7a7a68',
          muted:   '#353d4e',
        },
        gold: {
          DEFAULT: '#c89b3c',
          bright:  '#e4b84a',
          dim:     '#3d2e12',
        },
        azure: {
          DEFAULT: '#3d7fc1',
          dim:     '#111e2e',
          bright:  '#5a9cd6',
        },
        crimson: {
          DEFAULT: '#c13d3d',
          dim:     '#200d0d',
          bright:  '#d65a5a',
        },
      },
      fontFamily: {
        sans: ['var(--font-grotesk)', 'Space Grotesk', 'sans-serif'],
        mono: ['var(--font-mono)', 'Space Mono', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
}
