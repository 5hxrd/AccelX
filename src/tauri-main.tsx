// Entry point for the desktop (Tauri) build. The web/Lovable build keeps using src/routes/*.
import "./styles.css";
import { createRoot } from "react-dom/client";
import { WindowFrame } from "@/components/accelx/WindowFrame";

// Native-app feel: no browser right-click menu.
window.addEventListener("contextmenu", (e) => e.preventDefault());

createRoot(document.getElementById("root")!).render(<WindowFrame native />);
