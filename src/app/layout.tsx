import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KongsiRide — Drive Less. Share More.",
  description: "Platform pengesahan pinjaman kenderaan persendirian dengan e-tandatangan, pengesahan KYC, dan pembayaran FPX selamat.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>{children}</body>
    </html>
  );
}
