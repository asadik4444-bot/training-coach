import type { ReactNode } from "react";

export const metadata = {
  title: "Training Coach",
  description: "Personal training coach with HRV-aware AI",
};

// ── OLED design token CSS (injected via <style> — no Tailwind v4 needed) ────
// Tailwind v4 is CSS-first; given the existing inline-style pattern and
// <30 kb bundle target, CSS custom properties on :root are cleaner here.
const globalCSS = `
  *, *::before, *::after { box-sizing: border-box; }

  :root {
    /* Backgrounds */
    --bg:          #0A0A0F;
    --bg-surface:  #11121A;
    --bg-card:     #161824;

    /* Borders */
    --border:      #1F2937;
    --border-muted:#0F1018;

    /* Text */
    --text:        #F8FAFC;
    --text-muted:  #94A3B8;
    --text-dim:    #64748B;

    /* Brand */
    --primary:     #1E40AF;
    --primary-light:#3B82F6;
    --accent:      #D97706;

    /* Recovery bands */
    --green:       #22C55E;
    --yellow:      #EAB308;
    --red:         #EF4444;

    /* Typography */
    --font-sans:   "Fira Sans", system-ui, sans-serif;
    --font-mono:   "Fira Code", monospace;
  }

  body {
    margin: 0;
    padding: 0;
    font-family: var(--font-sans);
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* Safe-area insets for iPhone notch / home bar */
  .safe-top    { padding-top:    env(safe-area-inset-top); }
  .safe-bottom { padding-bottom: env(safe-area-inset-bottom); }

  /* Utility for hardware-accelerated transitions */
  .transition-fast { transition: all 150ms ease-out; }
  .transition-med  { transition: all 280ms ease-out; }

  /* Respect reduced-motion */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  }

  /* Two-column responsive grid (used in streaks/body side-by-side) */
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
  @media (max-width: 480px) { .two-col { grid-template-columns: 1fr; } }

  a { color: inherit; text-decoration: none; }
  a:hover { text-decoration: underline; }

  /* Monospace numerics */
  .mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }

  /* Glow effect for hero metric numbers */
  .metric-glow { text-shadow: 0 0 10px currentColor; }
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Viewport — viewport-fit=cover for iPhone notch/island */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />

        {/* PWA manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* iOS Add-to-Home-Screen */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="Training" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        {/* Theme color — OLED dark */}
        <meta name="theme-color" content="#0A0A0F" />

        {/* Fira Sans + Fira Code from Google Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500&family=Fira+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <style dangerouslySetInnerHTML={{ __html: globalCSS }} />
        {children}
      </body>
    </html>
  );
}
