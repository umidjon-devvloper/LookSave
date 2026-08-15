/** @type {import('tailwindcss').Config} */
// Ranglar 07-web-panels.md §7 dan — mobil ilova bilan bir xil manba.
// Panel varianti: glow yo'q, fon `panel`, asos 14px.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0A0A0F',
        panel: '#0F0D16',
        surface: '#14121C',
        surface2: '#1C1928',
        border: '#241F33',
        borderStrong: '#332B4A',
        primary: '#8B5CF6',
        primaryDim: '#6D3FD9',
        accent: '#C084FC',
        muted: '#9B96AE',
        dim: '#635D78',
        limited: '#F5C518',
        success: '#22C55E',
        warning: '#F59E0B',
        danger: '#EF4444',
      },
      borderRadius: { card: '16px' },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      fontSize: {
        // Panelda asos 14px — ma'lumot zichligi yuqori
        base: ['14px', '20px'],
      },
      letterSpacing: { label: '0.1em', wordmark: '0.32em' },
    },
  },
  plugins: [],
};
