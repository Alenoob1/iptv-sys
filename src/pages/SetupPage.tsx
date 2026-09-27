import { useTitle } from "../components/ui";

export function SetupPage() {
  useTitle("Configuración");
  return (
    <section className="auth-screen">
      <div className="auth-copy">
        <p className="eyebrow">Fibcom IPTV</p>
        <h1>Conecta Supabase para empezar</h1>
        <p>El panel ya está listo. Falta el proyecto donde vivirán los usuarios, las suscripciones y las listas.</p>
      </div>
      <div className="auth-card setup-card">
        <ol>
          <li>Crea un proyecto en supabase.com.</li>
          <li>En el editor SQL, ejecuta el archivo <code>supabase/schema.sql</code>.</li>
          <li>En Authentication, desactiva el registro público y la confirmación de correo para el entorno de prueba.</li>
          <li>Crea el primer usuario. Esa cuenta queda como administrador.</li>
          <li>Copia <code>.env.example</code> a <code>.env</code> y pega la URL y la clave anon.</li>
          <li>Reinicia <code>npm run dev</code>.</li>
        </ol>
        <p className="hint">La clave service_role no va en el navegador. Solo la usa la función <code>playlist</code> al desplegarla.</p>
      </div>
    </section>
  );
}
