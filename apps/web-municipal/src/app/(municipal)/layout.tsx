import type { ReactNode } from "react";
import { MunicipalShell } from "../../components/Layout/MunicipalShell";

export default function MunicipalLayout({ children }: { children: ReactNode }) {
  return <MunicipalShell>{children}</MunicipalShell>;
}
