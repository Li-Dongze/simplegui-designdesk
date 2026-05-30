import React from "react";
import ReactDOM from "react-dom/client";
import { AppShell } from "@/app/AppShell";
import { installDesignDeskApi } from "@/api/designDeskApi";
import "@/styles/global.css";

installDesignDeskApi();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppShell />
  </React.StrictMode>,
);
