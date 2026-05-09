import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI App Compiler Dashboard",
  description: "Production-grade deterministic app compilation pipeline",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
