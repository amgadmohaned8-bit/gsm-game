import type { MetadataRoute } from "next";

/** Installed / APK builds open sideways and fullscreen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GSM – Global Soccer Manager",
    short_name: "GSM",
    description: "Choose your league, take charge of a club and build a managerial legacy.",
    start_url: "/",
    display: "standalone",
    display_override: ["fullscreen", "standalone"],
    scope: "/",
    categories: ["games", "sports"],
    orientation: "landscape",
    background_color: "#05070d",
    theme_color: "#05070d",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
