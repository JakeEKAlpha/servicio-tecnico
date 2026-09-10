import type { MetadataRoute } from "next";

/** Manifest PWA — identidad "Servicio Técnico" (azul Alpha). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Servicio Técnico · Alpha Digital",
    short_name: "Servicio Técnico",
    description:
      "Gestión de órdenes de servicio técnico Lexmark — Alpha Digital / Baja Digital.",
    start_url: "/tablero",
    display: "standalone",
    background_color: "#203F7E",
    theme_color: "#203F7E",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/icon.png", type: "image/png", sizes: "96x96" },
      {
        src: "/apple-icon.png",
        type: "image/png",
        sizes: "180x180",
        purpose: "maskable",
      },
    ],
  };
}
