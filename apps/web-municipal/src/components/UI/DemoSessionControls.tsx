"use client";

import { useSession } from "../../hooks/useSession";
import { isSessionRole, sessionRoleLabels } from "../../types/session";

export function DemoSessionControls() {
  const { session, demoAllowed, setDemoRole } = useSession();
  if (!demoAllowed || session?.source !== "demo") return null;

  return (
    <div className="demo-session-controls">
      <label htmlFor="perfil-demostracion">Perfil de demostración</label>
      <select
        id="perfil-demostracion"
        value={session.rol}
        onChange={(event) => {
          if (isSessionRole(event.target.value)) setDemoRole(event.target.value);
        }}
      >
        <option value="inspector">{sessionRoleLabels.inspector}</option>
        <option value="administrador">{sessionRoleLabels.administrador}</option>
      </select>
      <span>Selección local, sin credenciales.</span>
    </div>
  );
}
