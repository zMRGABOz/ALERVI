import type { Metadata } from "next";
import { LoginForm } from "../../components/Auth/LoginForm";
import { safeLoginReturnTo } from "../../config/routes";

export const metadata: Metadata = { title: "Ingresar · ALERVI" };

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = await searchParams;
  return <LoginForm returnTo={safeLoginReturnTo(typeof search.returnTo === "string" ? search.returnTo : undefined)} />;
}
