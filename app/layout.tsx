import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "./components/Navbar";
import ConditionalSearchBar from "./components/ConditionalSearchBar";
import ConditionalNavbar from "./components/ConditionalNavbar";
// merge viewport settings into metadata below
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: 'Payment',
}

// ✅ Tambahkan export terpisah untuk viewport
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1, // Bagus buat WebView biar user gak bisa zoom-zoom iseng
}


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      <ConditionalSearchBar />
      <ConditionalNavbar />
      </body>
    </html>
  );
}
