"use client";

import { useContext } from "react";
import { SessionContext } from "../components/Auth/SessionProvider";

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession debe usarse dentro de SessionProvider.");
  return context;
}
