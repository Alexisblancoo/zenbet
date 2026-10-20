/**
 * ZENBET / TAILWIND DESIGN TOKENS
 *
 * Fuente de verdad runtime: src/styles/tokens.css.
 * Tailwind consume esos canales RGB para conservar los modificadores de opacidad
 * (`border-odds-up/30`, `bg-obsidian-surface/80`, etc.) sin duplicar valores.
 *
 * Rejilla: base 4px, ritmo preferente 8px. Los medios pasos (2/6/10/14px)
 * existen solo para ajuste óptico de iconos y hairlines.
 *
 * @type {import('tailwindcss').Config}
 */
const token = (name) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        /* Superficies: nunca negro puro; traza azul-violeta muy baja. */
        obsidian: {
          DEFAULT: token('--zb-canvas'),
          abyss: token('--zb-canvas'),
          void: token('--zb-canvas-raised'),
          surface: token('--zb-surface'),
          card: token('--zb-surface-raised'),
          elevated: token('--zb-surface-elevated'),
          border: token('--zb-border'),
          strong: token('--zb-border-strong'),
        },

        /* Alias semánticos para producto y nuevas vistas. */
        canvas: token('--zb-canvas'),
        surface: {
          DEFAULT: token('--zb-surface'),
          raised: token('--zb-surface-raised'),
          elevated: token('--zb-surface-elevated'),
          interactive: token('--zb-surface-interactive'),
        },
        line: {
          DEFAULT: token('--zb-border'),
          subtle: token('--zb-line-subtle'),
          strong: token('--zb-border-active'),
        },
        ink: {
          DEFAULT: token('--zb-text'),
          secondary: token('--zb-text-secondary'),
          muted: token('--zb-text-muted'),
          faint: token('--zb-text-faint'),
          inverse: token('--zb-ink-inverse'),
        },

        /* Marca. */
        crimson: {
          DEFAULT: token('--zb-crimson-500'),
          electric: token('--zb-crimson-500'),
          pure: token('--zb-crimson-600'),
          blood: token('--zb-crimson-700'),
          deep: token('--zb-crimson-900'),
          glow: 'rgb(var(--zb-crimson-500) / 0.45)',
          50: token('--zb-crimson-50'),
          100: token('--zb-crimson-100'),
          200: token('--zb-crimson-200'),
          300: token('--zb-crimson-300'),
          400: token('--zb-crimson-400'),
          500: token('--zb-crimson-500'),
          600: token('--zb-crimson-600'),
          700: token('--zb-crimson-700'),
          800: token('--zb-crimson-800'),
          900: token('--zb-crimson-900'),
        },
        gold: {
          DEFAULT: token('--zb-gold-500'),
          imperial: token('--zb-gold-500'),
          specular: token('--zb-gold-100'),
          bright: token('--zb-gold-400'),
          burnished: token('--zb-gold-700'),
          antique: token('--zb-gold-900'),
          glow: 'rgb(var(--zb-gold-500) / 0.4)',
        },
        metallic: {
          chrome: token('--zb-metal-50'),
          platinum: token('--zb-metal-100'),
          steel: token('--zb-metal-200'),
          titanium: token('--zb-metal-400'),
          slate: token('--zb-metal-500'),
          gunmetal: token('--zb-metal-600'),
          coldDark: token('--zb-metal-700'),
          voidDark: token('--zb-obsidian-850'),
        },

        /* Semántica de cuotas. Verde = sube, rojo = baja, ámbar = live. */
        odds: {
          up: token('--zb-odds-up'),
          'up-strong': token('--zb-odds-up-strong'),
          down: token('--zb-odds-down'),
          'down-strong': token('--zb-odds-down-strong'),
          live: token('--zb-odds-live'),
          neutral: token('--zb-odds-neutral'),
          draw: token('--zb-odds-draw'),
        },
        state: {
          success: token('--zb-positive'),
          danger: token('--zb-negative'),
          warning: token('--zb-warning'),
          info: token('--zb-info'),
        },
      },

      fontFamily: {
        display: ['Syne', 'Clash Display', 'Monument Extended', 'sans-serif'],
        sans: ['Space Grotesk', 'Noto Sans', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'IBM Plex Mono', 'SFMono-Regular', 'monospace'],
        odds: ['JetBrains Mono', 'IBM Plex Mono', 'SFMono-Regular', 'monospace'],
        technical: ['IBM Plex Mono', 'JetBrains Mono', 'monospace'],
      },

      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem', letterSpacing: '0.08em' }],
        'odds-xs': ['0.6875rem', { lineHeight: '1', letterSpacing: '-0.01em', fontWeight: '600' }],
        'odds-sm': ['0.8125rem', { lineHeight: '1', letterSpacing: '-0.015em', fontWeight: '600' }],
        'odds-md': ['1rem', { lineHeight: '1', letterSpacing: '-0.025em', fontWeight: '700' }],
        'odds-lg': ['1.375rem', { lineHeight: '1', letterSpacing: '-0.035em', fontWeight: '700' }],
        'display-sm': ['clamp(1.75rem, 3vw, 2.25rem)', { lineHeight: '1.04', letterSpacing: '-0.045em' }],
        display: ['clamp(2.5rem, 5vw, 4rem)', { lineHeight: '0.96', letterSpacing: '-0.055em' }],
      },

      letterSpacing: {
        tightest: '-0.06em',
        tighter: '-0.04em',
        tight: '-0.02em',
        odds: '-0.025em',
        brutal: '0.18em',
        ultra: '0.3em',
      },

      lineHeight: {
        odds: '1',
        panel: '1.35',
      },

      /* Rejilla explícita. Tailwind conserva sus valores por defecto. */
      spacing: {
        '0.5': '2px',
        1: '4px',
        '1.5': '6px',
        2: '8px',
        '2.5': '10px',
        3: '12px',
        '3.5': '14px',
        4: '16px',
        5: '20px',
        6: '24px',
        7: '28px',
        8: '32px',
        9: '36px',
        10: '40px',
        11: '44px',
        12: '48px',
        14: '56px',
        16: '64px',
        18: '72px',
        20: '80px',
        24: '96px',
        28: '112px',
        32: '128px',
        'control-sm': 'var(--zb-control-sm)',
        'control-md': 'var(--zb-control-md)',
        'control-lg': 'var(--zb-control-lg)',
        nav: 'var(--zb-nav-height)',
        betslip: 'var(--zb-betslip-width)',
      },

      /* Radios exactos, alineados a la especificación visual. */
      borderRadius: {
        none: 'var(--zb-radius-none)',
        xs: 'var(--zb-radius-xs)',
        sm: 'var(--zb-radius-sm)',
        DEFAULT: 'var(--zb-radius-sm)',
        md: 'var(--zb-radius-md)',
        lg: 'var(--zb-radius-lg)',
        xl: 'var(--zb-radius-xl)',
        '2xl': 'var(--zb-radius-2xl)',
        full: 'var(--zb-radius-full)',
      },

      boxShadow: {
        /* Elevación difusa: sombra amplia, baja opacidad, sin negro puro. */
        panel: 'var(--zb-shadow-panel)',
        float: 'var(--zb-shadow-float)',
        inset: 'var(--zb-shadow-inset)',
        focus: 'var(--zb-shadow-focus)',
        'odds-up': 'var(--zb-shadow-up)',
        'odds-down': 'var(--zb-shadow-down)',
        live: 'var(--zb-shadow-live)',
        /* Compatibilidad con los nombres existentes del producto. */
        'brutal-crimson': '4px 4px 0px 0px rgb(var(--zb-crimson-500))',
        'brutal-crimson-lg': '6px 6px 0px 0px rgb(var(--zb-crimson-500))',
        'brutal-crimson-sm': '2px 2px 0px 0px rgb(var(--zb-crimson-500))',
        'brutal-gold': '4px 4px 0px 0px rgb(var(--zb-gold-500))',
        'brutal-gold-lg': '6px 6px 0px 0px rgb(var(--zb-gold-500))',
        'brutal-gold-sm': '2px 2px 0px 0px rgb(var(--zb-gold-500))',
        'brutal-chrome': '4px 4px 0px 0px rgb(var(--zb-metal-100))',
        'brutal-gunmetal': '5px 5px 0px 0px rgb(var(--zb-obsidian-850))',
        'glow-crimson': '0px 0px 28px -4px rgb(var(--zb-crimson-500) / 0.5)',
        'glow-gold': '0px 0px 28px -4px rgb(var(--zb-gold-500) / 0.45)',
        'glow-metallic': '0px 0px 20px -4px rgb(var(--zb-metal-100) / 0.25)',
      },

      dropShadow: {
        panel: '0 18px 36px rgb(0 0 0 / 0.42)',
        odds: '0 4px 18px rgb(var(--zb-odds-up) / 0.2)',
      },

      backdropBlur: {
        glass: 'var(--zb-glass-blur)',
      },

      backgroundImage: {
        'gradient-obsidian-radial':
          'radial-gradient(ellipse at 50% 0%, rgb(var(--zb-surface-raised)) 0%, rgb(var(--zb-canvas)) 72%)',
        'gradient-metallic-cold':
          'linear-gradient(135deg, rgb(var(--zb-metal-100)) 0%, rgb(var(--zb-metal-400)) 42%, rgb(var(--zb-metal-700)) 100%)',
        'gradient-crimson-fire':
          'linear-gradient(135deg, rgb(var(--zb-crimson-500)) 0%, rgb(var(--zb-crimson-600)) 58%, rgb(var(--zb-crimson-900)) 100%)',
        'gradient-gold-royal':
          'linear-gradient(135deg, rgb(var(--zb-gold-100)) 0%, rgb(var(--zb-gold-500)) 55%, rgb(var(--zb-gold-900)) 100%)',
        'gradient-glass-sheen':
          'linear-gradient(145deg, rgb(255 255 255 / 0.07) 0%, transparent 44%, rgb(255 255 255 / 0.018) 100%)',
        'gradient-ambient-crimson':
          'radial-gradient(ellipse at 50% -10%, rgb(var(--zb-crimson-500) / 0.12) 0%, transparent 62%)',
        'grid-hairline':
          'linear-gradient(to right, rgb(var(--zb-border) / 0.55) 1px, transparent 1px), linear-gradient(to bottom, rgb(var(--zb-border) / 0.55) 1px, transparent 1px)',
      },

      backgroundSize: {
        'grid-hairline': '32px 32px',
      },

      transitionTimingFunction: {
        'out-expo': 'var(--zb-ease-out)',
        snap: 'var(--zb-ease-snap)',
        'in-out-editorial': 'var(--zb-ease-in-out)',
      },

      transitionDuration: {
        fast: 'var(--zb-duration-fast)',
        base: 'var(--zb-duration-base)',
        slow: 'var(--zb-duration-slow)',
        reveal: 'var(--zb-duration-reveal)',
      },

      animation: {
        'shimmer-sweep': 'shimmerSweep 2.5s infinite linear',
        'pulse-radar': 'pulseRadar 2.4s infinite var(--zb-ease-in-out)',
        marquee: 'marquee 28s infinite linear',
        'odds-rise': 'oddsRise 720ms var(--zb-ease-out) both',
        'odds-fall': 'oddsFall 720ms var(--zb-ease-out) both',
        'live-breathe': 'liveBreathe 2.2s var(--zb-ease-in-out) infinite',
        'reveal-up': 'revealUp var(--zb-duration-reveal) var(--zb-ease-out) both',
      },

      keyframes: {
        shimmerSweep: {
          '0%': { transform: 'translateX(-120%)' },
          '100%': { transform: 'translateX(220%)' },
        },
        pulseRadar: {
          '0%': { opacity: '0.9' },
          '50%': { opacity: '0.35' },
          '100%': { opacity: '0.9' },
        },
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        oddsRise: {
          '0%': { backgroundColor: 'rgb(var(--zb-odds-up) / 0.2)' },
          '100%': { backgroundColor: 'transparent' },
        },
        oddsFall: {
          '0%': { backgroundColor: 'rgb(var(--zb-odds-down) / 0.2)' },
          '100%': { backgroundColor: 'transparent' },
        },
        liveBreathe: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.45' },
        },
        revealUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },

      zIndex: {
        sticky: 'var(--zb-z-sticky)',
        header: 'var(--zb-z-header)',
        betslip: 'var(--zb-z-betslip)',
        overlay: 'var(--zb-z-overlay)',
        modal: 'var(--zb-z-modal)',
        toast: 'var(--zb-z-toast)',
      },

      maxWidth: {
        content: 'var(--zb-content-max)',
        betslip: 'var(--zb-betslip-width)',
      },

      screens: {
        '3xl': '1800px',
      },
    },
  },
  plugins: [],
};
