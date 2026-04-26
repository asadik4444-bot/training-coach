import type { ReactNode } from "react";

export const metadata = {
  title: "Training Coach",
  description: "Personal training coach with HRV-aware AI",
};

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
      <body
        style={{
          margin: 0,
          padding: 0,
          fontFamily: '"Fira Sans", system-ui, sans-serif',
          background: "#0A0A0F",
          color: "#F8FAFC",
          minHeight: "100vh",
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
        }}
      >
        {children}
      </body>
    </html>
  );
}
