import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TradeVerse",
    short_name: "TradeVerse",
    description:
      "A daily 5-minute chart-reading skill game on Indian markets. Play solo, race friends. Zero real money.",
    start_url: "/profile",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#020617",
    theme_color: "#020617",
    categories: ["education", "finance", "games"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-maskable.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Play today",
        short_name: "Play",
        description: "Jump straight to today's 5-question daily challenge.",
        url: "/play",
        icons: [{ src: "/icon-192.svg", sizes: "192x192" }],
      },
      {
        name: "Trading floor",
        short_name: "Floor",
        description: "Open your clubs.",
        url: "/clubs",
        icons: [{ src: "/icon-192.svg", sizes: "192x192" }],
      },
      {
        name: "Inbox",
        short_name: "Inbox",
        description: "Latest activity + rewards.",
        url: "/inbox",
        icons: [{ src: "/icon-192.svg", sizes: "192x192" }],
      },
    ],
  };
}
