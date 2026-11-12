import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SessionProvider } from "../components/Auth/SessionProvider";
import { DemoBanner } from "../components/UI/DemoBanner";
import "./globals.css";

export const metadata: Metadata = {
  title: "ALERVI · Plataforma municipal",
  description:
    "Plataforma municipal de apoyo a la priorización vial en Concepción, Chile.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-CL">
      <body className="antialiased">
        <SessionProvider>
          <DemoBanner />
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
