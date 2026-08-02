export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: '#0B0F14',
        panel: '#121821',
        edge: '#1F2A37',
        gold: '#C9A24B',
        amber: '#E8B85C',
        mist: '#8A97A6',
        paper: '#F4F1EA'
      },
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace']
      }
    },
  },
  plugins: [],
}
