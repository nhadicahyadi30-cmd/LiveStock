import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Nusa Ternak", template: "%s | Nusa Ternak" },
  description: "Nusa Ternak: ekosistem ternak cerdas untuk Nusantara.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

// Menetapkan tema sebelum halaman tampil agar tidak berkedip.
const THEME_SCRIPT = `try{var t=localStorage.getItem("nt.theme");if(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches)t="dark";if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /></head>
      <body>{children}</body>
    </html>
  );
}
