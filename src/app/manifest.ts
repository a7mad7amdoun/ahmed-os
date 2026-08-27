import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ahmed OS",
    short_name: "Ahmed OS",
    description: "Deen first. Discipline always. Progress through consistency.",
    start_url: "/",
    display: "standalone",
    background_color: "#0B0F0D",
    theme_color: "#0B0F0D",
    orientation: "portrait",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
