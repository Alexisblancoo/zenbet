/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
    './src/pages/**/*.{js,ts,jsx,tsx}',
    './src/modules/**/*.{js,ts,jsx,tsx}',
    './src/layouts/**/*.{js,ts,jsx,tsx}',
    './src/routes/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Fondo Obsidiana Oscura (Abisal y Superficie Industrial)
        obsidian: {
          DEFAULT: '#07090C',
          abyss: '#040507',
          void: '#07090C',
          surface: '#0C1017',
          card: '#111722',
          elevated: '#171F2E',
          border: '#1F293D',
        },
        // Acento Carmesí Agresivo (Adrenalina, Tensión, Cuotas Live)
        crimson: {
          DEFAULT: '#FF2E51',
          electric: '#FF2E51',
          pure: '#E60026',
          blood: '#A3001B',
          deep: '#5C000F',
          glow: 'rgba(255, 46, 81, 0.45)',
          50: '#FFEBEF',
          100: '#FFD6DF',
          200: '#FFADC0',
          300: '#FF85A0',
          400: '#FF5C81',
          500: '#FF2E51',
          600: '#E60026',
          700: '#B3001E',
          800: '#800015',
          900: '#4D000D',
        },
        // Oro Imperial Zenbet (Victoria, Multiplicador VIP, Prestigio)
        gold: {
          DEFAULT: '#D4AF37',
          imperial: '#D4AF37',
          specular: '#FDF3C7',
          bright: '#F59E0B',
          burnished: '#997D20',
          antique: '#524310',
          glow: 'rgba(212, 175, 55, 0.4)',
        },
        // Grises Metálicos Fríos (Titanio, Cromo, Acero Quirúrgico y Gunmetal)
        metallic: {
          chrome: '#F8FAFC',
          platinum: '#E2E8F0',
          steel: '#CBD5E1',
          titanium: '#94A3B8',
          slate: '#64748B',
          gunmetal: '#334155',
          coldDark: '#1E293B',
          voidDark: '#0F172A',
        },
      },
      fontFamily: {
        display: ['Syne', 'Clash Display', 'Monument Extended', 'sans-serif'],
        sans: ['Space Grotesk', 'Inter', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Space Mono', 'IBM Plex Mono', 'monospace'],
        technical: ['IBM Plex Mono', 'monospace'],
      },
      letterSpacing: {
        tightest: '-0.06em',
        tighter: '-0.04em',
        tight: '-0.02em',
        brutal: '0.18em',
        ultra: '0.3em',
      },
      boxShadow: {
        // Brutalismo Puro: Sombras duras de 0px blur
        'brutal-crimson': '4px 4px 0px 0px #FF2E51',
        'brutal-crimson-lg': '6px 6px 0px 0px #FF2E51',
        'brutal-crimson-sm': '2px 2px 0px 0px #FF2E51',
        'brutal-gold': '4px 4px 0px 0px #D4AF37',
        'brutal-gold-lg': '6px 6px 0px 0px #D4AF37',
        'brutal-gold-sm': '2px 2px 0px 0px #D4AF37',
        'brutal-chrome': '4px 4px 0px 0px #E2E8F0',
        'brutal-gunmetal': '5px 5px 0px 0px #0F172A',
        // Resplandores quirúrgicos para estados activos
        'glow-crimson': '0px 0px 28px -4px rgba(255, 46, 81, 0.5)',
        'glow-gold': '0px 0px 28px -4px rgba(212, 175, 55, 0.45)',
        'glow-metallic': '0px 0px 20px -4px rgba(226, 232, 240, 0.25)',
      },
      borderWidth: {
        hairline: '0.5px',
        1: '1px',
        3: '3px',
      },
      animation: {
        'shimmer-sweep': 'shimmerSweep 2.5s infinite linear',
        'pulse-radar': 'pulseRadar 2s infinite cubic-bezier(0, 0, 0.2, 1)',
        'marquee': 'marquee 28s infinite linear',
      },
      keyframes: {
        shimmerSweep: {
          '0%': { transform: 'translateX(-120%)' },
          '100%': { transform: 'translateX(220%)' },
        },
        pulseRadar: {
          '0%': { transform: 'scale(0.95)', opacity: '0.9' },
          '50%': { transform: 'scale(1.05)', opacity: '0.4' },
          '100%': { transform: 'scale(0.95)', opacity: '0.9' },
        },
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      backgroundImage: {
        'gradient-obsidian-radial': 'radial-gradient(ellipse at 50% 15%, #111722 0%, #07090C 85%)',
        'gradient-metallic-cold': 'linear-gradient(135deg, #E2E8F0 0%, #94A3B8 40%, #1E293B 100%)',
        'gradient-crimson-fire': 'linear-gradient(135deg, #FF2E51 0%, #E60026 60%, #5C000F 100%)',
        'gradient-gold-royal': 'linear-gradient(135deg, #FDF3C7 0%, #D4AF37 55%, #524310 100%)',
      },
    },
  },
  plugins: [],
};
