import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./design-editor.css";
import "./gear-overrides.css";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Unofficial PoE2 Build Planner",
  description:
    "Unofficial Path of Exile 2 build planner — passive tree, gear, and skills. Not affiliated with Grinding Gear Games.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-theme="sablesteel"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
