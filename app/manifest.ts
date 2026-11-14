import type { MetadataRoute } from "next";

/** Installed / APK builds open sideways and fullscreen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GSM – Global Soccer Manager",
    short_name: "GSM",
    description: "Choose your league, take charge of a club and build a managerial legacy.",
    start_url: "/",
    display: "fullscreen",
    orientation: "landscape",
    background_color: "#05070d",
    theme_color: "#05070d",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
