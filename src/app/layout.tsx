import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SG Private Property — Transaction Intelligence",
  description:
    "Singapore private residential transactions from URA: price/PSF trends, rental yield, appreciation, and comparables.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
