const plugin = require('tailwindcss/plugin');

const sizes = {
  '2xs': '1.25rem',
  xs: '1.8rem',
  sm: '2.0rem',
  md: '2.5rem',
};

/** @type {import("tailwindcss").Config} */
module.exports = {
  darkMode: ['class', '[data-resolved-appearance="dark"]'],
  content: ['./index.html', './**/*.{html,js,jsx,ts,tsx}'],
  theme: {
    extend: {
      opacity: {
        disabled: '0.3',
      },
      fontSize: {
        xs: '0.8rem',
      },
      height: sizes,
      width: sizes,
      minHeight: sizes,
      minWidth: sizes,
      lineHeight: {
        // HACK: Minus 2 to account for borders inside inputs
        xs: 'calc(1.75rem - 2px)',
        sm: 'calc(2.0rem - 2px)',
        md: 'calc(2.5rem - 2px)',
      },
      transitionProperty: {
        grid: 'grid',
      },
    },
    fontFamily: {
      mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      sans: [
        'Inter UI',
        '-apple-system',
        'BlinkMacSystemFont',
        'Segoe UI',
        'Roboto',
        'Oxygen-Sans',
        'Ubuntu',
        'Cantarell',
        'Helvetica Neue',
        'sans-serif',
        'Apple Color Emoji',
        'Segoe UI Emoji',
        'Segoe UI Symbol',
      ],
    },
    fontSize: {
      '4xs': '0.6rem',
      '3xs': '0.675rem',
      '2xs': '0.75rem',
      xs: '0.8rem',
      sm: '0.9rem',
      base: '1rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '2rem',
      '4xl': '2.5rem',
      '5xl': '3rem',
      editor: 'var(--editor-font-size)',
      shrink: '0.8em',
    },
    boxShadow: {
      DEFAULT: '0 1px 3px 0 var(--shadow);',
      lg: '0 10px 15px -3px var(--shadow)',
    },
    colors: {
      transparent: 'transparent',
      placeholder: 'var(--textSubtlest)',
      shadow: 'var(--shadow)',
      backdrop: 'var(--backdrop)',
      selection: 'var(--selection)',

      // New theme values

      surface: 'var(--surface)',
      'surface-highlight': 'var(--surfaceHighlight)',
      'surface-active': 'var(--surfaceActive)',

      text: 'var(--text)',
      'text-subtle': 'var(--textSubtle)',
      'text-subtlest': 'var(--textSubtlest)',

      border: 'var(--border)',
      'border-subtle': 'var(--borderSubtle)',
      'border-focus': 'var(--borderFocus)',

      primary: 'var(--primary)',
      danger: 'var(--danger)',
      secondary: 'var(--secondary)',
      success: 'var(--success)',
      info: 'var(--info)',
      notice: 'var(--notice)',
      warning: 'var(--warning)',
    },
  },
  plugins: [
    require('@tailwindcss/container-queries'),
    plugin(function ({ addVariant }) {
      addVariant('hocus', ['&:hover', '&:focus-visible', '&.focus:focus']);
      addVariant('focus-visible-or-class', ['&:focus-visible', '&.focus:focus']);
    }),
  ],
};