"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { env } from "../../config/env";
import { routes } from "../../config/routes";
import { useSession } from "../../hooks/useSession";
import { LoginError } from "../../services/auth";
import { sessionRoleLabels } from "../../types/session";
import { Icon } from "../UI/Icon";
import { QueryState } from "../UI/QueryState";

export function LoginForm({ returnTo }: { returnTo: string }) {
  const router = useRouter();
  const { status, session, signIn, endReason } = useSession();
  const id = useId();
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [codigoMfa, setCodigoMfa] = useState("");
  const [mfaRequested, setMfaRequested] = useState(false);
  const [pending, setPending] = useState(false);
  const [issue, setIssue] = useState<LoginError | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const mfaRef = useRef<HTMLInputElement>(null);
  const issueRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => requestRef.current?.abort(), []);
  useEffect(() => {
    if (status === "anonymous" && env.apiMode !== "mock") emailRef.current?.focus();
  }, [status]);
  useEffect(() => {
    if (!issue) return;
    if (issue.kind === "mfa-required" || issue.kind === "mfa-invalid") mfaRef.current?.focus();
    else if (issue.kind === "credentials") passwordRef.current?.focus();
    else issueRef.current?.focus();
  }, [issue]);

  function changeCredentials() {
    setIssue(null);
    setMfaRequested(false);
    setCodigoMfa("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setPending(true);
    setIssue(null);
    try {
      await signIn({ correo: correo.trim(), password, ...(mfaRequested ? { codigo_mfa: codigoMfa } : {}) }, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setPassword("");
      setCodigoMfa("");
      router.replace(returnTo);
    } catch (error) {
      if (controller.signal.aborted) return;
      const problem = error instanceof LoginError ? error : new LoginError("unavailable", "No fue posible iniciar sesión. Intenta nuevamente.", { status: 0, code: "ERROR_LOGIN" });
      if (problem.kind === "mfa-required" || problem.kind === "mfa-invalid") {
        setMfaRequested(true);
        setCodigoMfa("");
      }
      if (problem.kind === "credentials") setPassword("");
      setIssue(problem);
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      if (!controller.signal.aborted) setPending(false);
    }
  }

  return (
    <div className="login-shell">
      <a href="#contenido-principal" className="skip-link">Saltar al contenido</a>
      <header className="municipal-header login-header">
        <Link href={routes.map} className="municipal-brand" aria-label="ALERVI · Mapa público">
          <span className="municipal-brand__symbol"><Icon name="brand" size={24} /></span>
          <span><span className="municipal-brand__name">ALERVI</span><span className="municipal-brand__description">Plataforma municipal · Concepción</span></span>
        </Link>
        <Link href={routes.map} className="button-secondary"><Icon name="map" size={18} />Mapa público</Link>
      </header>
      <main id="contenido-principal" tabIndex={-1} className="login-main">
        <section className="surface-card login-card" aria-labelledby={`${id}-title`}>
          <div className="login-heading">
            <span className="login-symbol"><Icon name="user" size={28} /></span>
            <h1 id={`${id}-title`}>Acceso municipal</h1>
          </div>
          {status === "initializing" ? <QueryState state="loading" title="Inicializando sesión" description="Comprobando el acceso municipal." />
            : session ? <div className="login-session">
              <p role="status">Sesión {session.source === "demo" ? "local de demostración" : "iniciada"} · {sessionRoleLabels[session.rol]}</p>
              <Link href={returnTo} className="button-primary">Continuar al espacio municipal <span aria-hidden="true">→</span></Link>
            </div>
              : env.apiMode === "mock" ? <div className="login-session">
                <p role="status">Inicio de sesión no disponible en modo mock.</p>
                <Link href={routes.map} className="button-secondary">Ir al mapa público</Link>
              </div>
                : <>
                  {endReason && <p className="login-session-notice" role="status">{endReason === "expired" ? "Tu sesión expiró. Inicia sesión nuevamente para continuar." : "Has cerrado la sesión municipal."}</p>}
                  <form className="login-form" onSubmit={handleSubmit} aria-busy={pending}>
                    {issue && <div ref={issueRef} id={`${id}-error`} role="alert" tabIndex={-1} className={`login-message${issue.kind === "mfa-required" ? " login-message--information" : ""}`}>{issue.message}</div>}
                    <div className="login-field">
                      <label htmlFor={`${id}-email`}>Correo institucional</label>
                      <input ref={emailRef} id={`${id}-email`} name="correo" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required disabled={pending} value={correo} aria-invalid={issue?.kind === "credentials"} aria-describedby={issue?.kind === "credentials" ? `${id}-error` : undefined} onChange={(event) => { setCorreo(event.target.value); changeCredentials(); }} />
                    </div>
                    <div className="login-field">
                      <label htmlFor={`${id}-password`}>Contraseña</label>
                      <input ref={passwordRef} id={`${id}-password`} name="password" type="password" autoComplete="current-password" required disabled={pending} value={password} aria-invalid={issue?.kind === "credentials"} aria-describedby={issue?.kind === "credentials" ? `${id}-error` : undefined} onChange={(event) => { setPassword(event.target.value); changeCredentials(); }} />
                    </div>
                    {mfaRequested && <div className="login-field">
                      <label htmlFor={`${id}-mfa`}>Código de verificación MFA</label>
                      <input ref={mfaRef} id={`${id}-mfa`} name="codigo_mfa" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required disabled={pending} value={codigoMfa} aria-invalid={issue?.kind === "mfa-invalid"} aria-describedby={issue?.kind === "mfa-required" || issue?.kind === "mfa-invalid" ? `${id}-error` : undefined} onChange={(event) => setCodigoMfa(event.target.value)} />
                    </div>}
                    <button type="submit" className="button-primary" disabled={pending}>{pending ? "Verificando acceso…" : mfaRequested ? "Verificar código e ingresar" : "Iniciar sesión"}</button>
                  </form>
                </>}
        </section>
      </main>
    </div>
  );
}
