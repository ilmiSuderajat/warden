import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
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
  title: 'Warung Kita',
}

// ✅ Tambahkan export terpisah untuk viewport
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  interactiveWidget: 'resizes-content', // Penting buat WebView biar layout geser pas keyboard muncul
}


import { Toaster } from "sonner";

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
        <Toaster position="top-center" richColors />
        {children}
        <ConditionalSearchBar />
        <ConditionalNavbar />
      </body>
    </html>
  );
}
