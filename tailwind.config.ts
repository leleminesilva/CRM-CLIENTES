import type { Config } from "tailwindcss";

// Cor vinda de variável CSS em hex que aceita modificador de opacidade (bg-ink/10).
// O Tailwind 3 aceita cor como função, mas o tipo `Config` só prevê string: daí o cast.
const token = (name: string) =>
  (({ opacityValue }: { opacityValue?: string }) =>
    opacityValue === undefined
      ? `var(--${name})`
      : `color-mix(in srgb, var(--${name}) calc(${opacityValue} * 100%), transparent)`) as unknown as string;

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/fin/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        // Tokens nomeados do Financeiro novo (hex em globals.css). Função com color-mix para que
        // a transparência (`bg-ink/10`) funcione no Tailwind 3, como no Tailwind 4 do sistema original.
        page: token("page"),
        surface: { DEFAULT: token("surface"), raised: token("surface-raised"), sunken: token("surface-sunken") },
        ink: { DEFAULT: token("ink"), 2: token("ink-2"), 3: token("ink-3") },
        line: { DEFAULT: token("line"), strong: token("line-strong") },
        positive: token("positive"),
        critical: token("critical"),
        "warning-text": token("warning-text"),
        "on-ink": token("on-ink"),
        series: {
          income: token("series-income"),
          expense: token("series-expense"),
          commission: token("series-commission"),
          variable: token("series-variable"),
          extra: token("series-extra"),
          other: token("series-other"),
        },
        // Status: fixos, sempre acompanhados de ícone e texto
        status: { good: "#0ca30c", warning: "#fab219", serious: "#ec835a", critical: "#d03b3b" },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        // Design system do Financeiro novo
        control: "6px",
        card: "10px",
        dialog: "14px",
      },
      boxShadow: {
        float: "var(--shadow-float)",
      },
      // O Tailwind 4 aceita qualquer opacidade inteira (bg-ink/88); o 3 só a escala de 5 em 5.
      opacity: Object.fromEntries(Array.from({ length: 101 }, (_, n) => [String(n), String(n / 100)])),
      // Campos com erro (aria-invalid="true"), variante nativa do Tailwind 4.
      aria: { invalid: 'invalid="true"' },
      transitionTimingFunction: {
        standard: "cubic-bezier(0.2, 0, 0, 1)",
      },
      // Durações do design system com nome: `duration-[120ms]` fica ambíguo no Tailwind 3
      // (o tailwindcss-animate também registra `duration-*`) e não gera CSS.
      transitionDuration: { 120: "120ms", 280: "280ms" },
      fontFamily: {
        sans: ["var(--font-archivo)", "Archivo", "system-ui", "sans-serif"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
