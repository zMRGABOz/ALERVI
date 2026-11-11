export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section
        aria-labelledby="titulo-principal"
        className="w-full max-w-2xl space-y-4"
      >
        <p className="text-sm font-medium">Concepción, Chile</p>
        <h1
          id="titulo-principal"
          className="text-3xl font-semibold tracking-tight sm:text-4xl"
        >
          ALERVI · Plataforma municipal
        </h1>
        <p className="text-base leading-7">
          Plataforma municipal de apoyo a la priorización vial en Concepción.
        </p>
        <p className="text-sm leading-6">
          El esquema base está listo para integrar los módulos de consulta e
          inspecciones.
        </p>
      </section>
    </main>
  );
}
