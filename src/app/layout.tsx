import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const sfPro = localFont({
  src: "../../public/fonts/SF-Pro-Subset.woff2",
  variable: "--font-sf-pro",
  weight: "100 900",
  display: "swap",
});

const pretendard = localFont({
  src: "../../public/fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "100 900",
  display: "swap",
});

const helveticaBlack = localFont({
  src: "../../public/fonts/Helvetica-Black.ttf",
  variable: "--font-helvetica-black",
  weight: "900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "UTU Studios",
  description: "UTU Studios es un estudio multidisciplinario de diseño de producto.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sfPro.variable} ${pretendard.variable} ${helveticaBlack.variable} bg-black h-full antialiased`}
    >
      <body className="min-h-full bg-black">{children}</body>
    </html>
  );
}
