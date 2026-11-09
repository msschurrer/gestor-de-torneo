# Desarrollo y pruebas sin servicios pagos

Producción no se usa como base de ensayo. No ejecutar `supabase link`, `db push`, `db reset --linked`, creación de ramas alojadas ni scripts de asignación de roles como parte del desarrollo.

## Pruebas ejecutables sin Docker

```
npm ci
npm test
npm run test:platform
npm run build
```

La suite de aplicación incluye 62 pruebas y comprueba también el rechazo de solicitudes administrativas sin credenciales válidas.

La suite `test:platform` crea PostgreSQL aislado mediante PGlite, carga el esquema y simula identidades SQL para probar autorización. No usa credenciales ni datos de producción. No simula ni pretende validar el servicio real de Supabase Auth.

## Supabase completo local

Requisito: Docker instalado y ejecutándose. El entorno de ejecución de este trabajo no dispone de Docker; por eso la suite Auth está preparada y comprobada por TypeScript, pero no ejecutada aquí.

```
npm run local:start
npm run dev
```

El helper fija Supabase CLI 3.0.0, comprueba Docker antes de arrancar, usa el proyecto `gestor-torneos-local` y crea `.env.development.local` con la URL y la clave pública local. No sobrescribe `.env.local`, no imprime claves y nunca copia la clave service-role al cliente. El arranque inicial aplica las migraciones del repositorio. Si ya hay una base local anterior, revisar su estado antes de decidir una reconstrucción; los scripts no resetean datos automáticamente.

- Aplicación: http://127.0.0.1:3000
- Supabase API local: http://127.0.0.1:54321
- Correo de prueba Mailpit: http://127.0.0.1:54324

El registro está habilitado y se conserva la confirmación de correo, con mensajes capturados localmente. No hace falta un proveedor SMTP externo para estas pruebas. Para regenerar solo el archivo de configuración: `npm run local:env`. Para detener: `npm run local:stop`; no se borran volúmenes automáticamente.

## Pruebas de Auth e invitaciones reales

Con Supabase local iniciado:

```
npm run test:auth:local
```

La suite rechaza URLs que no sean loopback antes de cualquier solicitud. Crea dos cuentas ficticias con contraseñas aleatorias solo en memoria, encuentra sus correos en Mailpit, verifica la confirmación, inicia sesión y prueba la creación de varios torneos, exclusión de extraños, invitación de un uso, edición por el invitado, revocación con sesión abierta y persistencia tras cerrar sesión. Retira los torneos de prueba al terminar. Las cuentas ficticias quedan únicamente en el volumen local. No imprime contraseñas, tokens ni claves.

Esta suite está lista para ejecutarse en un equipo con Docker. Hasta entonces, sus escenarios no se reportan como aprobados.

## Registro y preparación del esquema son independientes

Se eliminó `PLATFORM_ACCOUNTS_READY`: ni el registro, ni el ingreso, ni la recuperación de contraseña dependen de Pro o de una bandera global.

La API comprueba la sesión y delega los permisos a PostgreSQL. Si aún no se aplicó la migración de administración en un entorno, responde de forma explícita que falta esa migración; nunca convierte al usuario en administrador ni usa enlaces públicos para dar acceso. `/api/platform/status` consulta una función de versión de esquema que no revela datos privados. Una cuenta puede registrarse antes de que esté disponible el editor con la arquitectura nueva.

La configuración real de Supabase Auth puede imponer confirmación, límites de envío o restricciones de registro: se muestran esos errores en lugar de fingir que la cuenta se creó.

## Superadministrador

No hay asignación automática. `supabase/admin/assign_superadmin.sql` es una operación manual, fuera de las migraciones y del registro, que exige UUID y correo de la misma cuenta confirmada y habilitada. Registra la asignación en auditoría. No se ejecutó ni se eligió ninguna cuenta. Antes de usarlo en producción debe confirmarse el correo y autorizarse la operación.
