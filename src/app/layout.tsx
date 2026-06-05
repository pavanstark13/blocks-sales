import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blocks Sales Manager",
  description: "Sales tracking and reporting for block manufacturing",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
