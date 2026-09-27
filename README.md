# Fibcom IPTV

Panel web para administrar clientes, cuentas IPTV, suscripciones, planes y listas M3U de Fibcom Group S.A. El frontend es React con TypeScript. Los datos, el acceso del personal y las reglas de negocio viven en Supabase.

## Qué hace

- Ingreso del personal con Supabase Auth. La primera cuenta es administrador; las siguientes entran como operador.
- Registro de clientes y generación de cuentas con usuario y contraseña de línea.
- Suscripciones con plan, vigencia y estados: pendiente, activa, suspendida, vencida y cancelada.
- Importación de archivos M3U y asignación de grupos de canales a cada plan.
- URL de lista para el cliente y descarga del M3U filtrado.
- Reportes con filtros y exportación CSV.
- Historial de cambios generado en la base de datos.

## Puesta en marcha

1. Crea un proyecto en [Supabase](https://supabase.com).
2. Abre el editor SQL y ejecuta `supabase/schema.sql`.
3. En Authentication desactiva el registro público. Para pruebas, desactiva también la confirmación de correo.
4. Crea el primer usuario desde Authentication. Esa persona será administrador.
5. Copia `.env.example` a `.env` y completa la URL del proyecto y la clave `anon`.
6. Instala y arranca:

```bash
npm install
npm run dev
```

La clave `service_role` no se pone en el frontend.

## Lista en vivo

La descarga desde el panel no necesita nada más. Para que un reproductor pida la lista por URL, despliega la función:

```bash
supabase functions deploy playlist --no-verify-jwt
```

La URL queda así:

`https://TU_PROYECTO.supabase.co/functions/v1/playlist?username=USUARIO&password=CLAVE`

La función responde solo si la cuenta está activa y la suscripción vigente. Si el plan no tiene grupos marcados, entrega todos los canales importados.
