import { createFileRoute } from "@tanstack/react-router";
import { WindowFrame } from "@/components/accelx/WindowFrame";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AccelX — Mouse acceleration curve editor" },
      { name: "description", content: "Shape your mouse acceleration curve, save presets and profiles, and test it live." },
      { property: "og:title", content: "AccelX — Mouse acceleration curve editor" },
      { property: "og:description", content: "Shape your mouse acceleration curve, save presets and profiles, and test it live." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WindowFrame,
});
