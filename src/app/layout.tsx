import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZytrOS - Virtual Web Computer By Zytronium",
  description: "An experimental web-based virtual desktop with web-based games and apps.",
};

export const viewport: Viewport = {
  themeColor: "#0a1018",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  );
}
