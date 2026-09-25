import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

// Telegram WebApp'ni sozlash (mavjud bo'lsa) — mini app to'liq ekranga yoyiladi
const tg = (window as unknown as { Telegram?: { WebApp?: any } }).Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  tg.setHeaderColor?.("#ffffff");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
