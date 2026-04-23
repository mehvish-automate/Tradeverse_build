import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/profile", "/play", "/squads/"],
      },
    ],
    sitemap: "https://tradeverse.app/sitemap.xml",
  };
}
