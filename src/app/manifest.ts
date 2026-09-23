import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Signal – Marktsignale",
    short_name: "Signal",
    description: "Kurse, News und Social-Diskussionen als transparente Marktsignale. Keine Anlageberatung.",
    lang: "de",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#000000",
    theme_color: "#000000",
    categories: ["finance", "news"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Heatmap", url: "/heatmap" },
      { name: "Entdecken", url: "/entdecken" },
      { name: "Watchlist", url: "/watchlist" },
    ],
  };
}
