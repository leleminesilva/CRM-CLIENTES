import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";

// Fonte hospedada no projeto (pacote @fontsource-variable/archivo): o build não depende do Google Fonts.
const archivo = localFont({
  src: "../../node_modules/@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2",
  weight: "100 900",
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
