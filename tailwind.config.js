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
          DEFAULT: '#252d3d',
          bright:  '#3a4e62',
        },
        ink: {
          DEFAULT: '#ddd6c4',
          dim:     '#9a9888',  /* ~4.5:1 on surface */
          muted:   '#606878',  /* ~3.5:1 on surface — labels/captions */
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
