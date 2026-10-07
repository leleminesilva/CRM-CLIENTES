import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const archivo = Archivo({
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Infinity Glass",
    template: "%s | Infinity Glass",
  },
  description: "Infinity Glass — gestão de clientes, leads, oportunidades e financeiro",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${archivo.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
