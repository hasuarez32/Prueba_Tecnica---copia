/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Los colores apuntan a variables CSS (src/index.css) para que el tema
      // claro/oscuro cambie sin duplicar clases.
      colors: {
        navy: 'var(--navy)',
        'navy-2': 'var(--navy-2)',
        ink: 'var(--ink)',
        pink: 'var(--pink)',
        'pink-soft': 'var(--pink-soft)',
        cyan: 'var(--cyan)',
        'cyan-soft': 'var(--cyan-soft)',
        'cyan-ink': 'var(--cyan-ink)',
        mint: 'var(--mint)',
        cream: 'var(--cream)',
        muted: 'var(--muted)',
        green: 'var(--green)',
        'green-soft': 'var(--green-soft)',
        gray: 'var(--gray)',
        line: 'var(--line)',
        'line-2': 'var(--line-2)',
        bg: 'var(--bg)',
        card: 'var(--card)',
        heading: 'var(--heading)',
        body: 'var(--body)',
        accent: 'var(--accent-solid)',
        'accent-on': 'var(--accent-on)',
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'monospace'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
      },
      borderRadius: {
        card: '22px',
        kpi: '20px',
        soft: '18px',
        pill: '999px',
      },
      maxWidth: { wrap: '1180px' },
    },
  },
  plugins: [],
}
