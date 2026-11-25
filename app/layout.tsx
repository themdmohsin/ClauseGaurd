import type { Metadata } from "next";
import "./clauseguard.css";

export const metadata: Metadata = {
  title: "ClauseGuard — Read between the lines",
  description: "Understand your agreements with source-linked findings, plain-language explanations, and questions to ask before signing.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
