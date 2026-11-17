import { Suspense, type ReactNode } from "react";
import { RequireSession } from "../../components/Auth/RequireSession";
import { MunicipalShell } from "../../components/Layout/MunicipalShell";
import { QueryState } from "../../components/UI/QueryState";

export default function MunicipalLayout({ children }: { children: ReactNode }) {
  return <MunicipalShell><Suspense fallback={<QueryState state="loading" title="Preparando acceso municipal" description="Leyendo el contexto de navegación." />}><RequireSession>{children}</RequireSession></Suspense></MunicipalShell>;
}
