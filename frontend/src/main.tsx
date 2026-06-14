import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";

import { App } from "@/app/App";

import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("No se encontró el div #root en index.html");

createRoot(root).render(
  <StrictMode>
    <App />
    <Toaster position="top-right" richColors closeButton />
  </StrictMode>,
);
