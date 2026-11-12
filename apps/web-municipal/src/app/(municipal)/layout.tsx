import type { ReactNode } from "react";
import { RequireSession } from "../../components/Auth/RequireSession";
import { MunicipalShell } from "../../components/Layout/MunicipalShell";

export default function MunicipalLayout({ children }: { children: ReactNode }) {
  return <MunicipalShell><RequireSession>{children}</RequireSession></MunicipalShell>;
}
