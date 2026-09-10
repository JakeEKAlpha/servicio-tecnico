import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import InlineScript from "@/components/InlineScript";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Servicio Técnico · Alpha Digital",
  description: "Gestión de órdenes de servicio técnico",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Servicio Técnico", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
};

// Sin preferencia guardada => se sigue el sistema (media query en globals.css).
// Con "dark"/"light" guardado => se fija data-theme antes de pintar (sin parpadeo).
const TEMA_SCRIPT = `try{var t=localStorage.getItem('tema');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t;if(localStorage.getItem('densidad')==='compacta')document.documentElement.dataset.densidad='compacta';}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${montserrat.variable} h-full antialiased`}
    >
      <head>
        <InlineScript html={TEMA_SCRIPT} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
