import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { initTelegram } from "./lib/telegram";

// Telegram WebApp'ni sozlash (mavjud bo'lsa) — to'liq ekran, mavzu ranglari
initTelegram();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
