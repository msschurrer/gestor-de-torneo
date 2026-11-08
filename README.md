# Gestor de Torneos

Web app independiente de FOCOemergency. Next.js App Router, React, TypeScript, Tailwind CSS, Zod y Supabase PostgreSQL/Auth/Storage. GitHub: msschurrer/gestor-de-torneo. Vercel: https://gestor-torneos-kappa.vercel.app.

## Uso

1. Abrir la web, elegir Crear cuenta, ingresar nombre, apellido, correo y contraseña y confirmar el correo mediante el enlace recibido. Una cuenta registrada puede ver todos los torneos públicos.
2. En Mis torneos → Crear torneo, configurar competencia, equipos, planteles, zonas, canchas y turnos.
3. Generar fixture, revisar equidad y publicar. Liga de una o varias zonas, ida/vuelta e interzonales de libres.
4. Elegir visibilidad: público para miembros registrados o privado para propietario y colaboradores. Los borradores se mantienen privados.
5. En Accesos, solo el propietario habilita o quita colaboradores sobre una cuenta ya creada, usando el código que esa persona comparte desde Mi cuenta. Los colaboradores pueden editar y cargar resultados, pero no cambiar la privacidad ni delegar permisos. No se envía un correo de invitación automático.
6. Cargar resultados, goles y tarjetas; posiciones y rankings se recalculan desde partidos finalizados publicados. Las correcciones quedan auditadas.

[Modelo de acceso vigente](docs/ACCESO_POR_TORNEO.md). Esta actualización reemplaza los requisitos originales de administradores centrales y portal anónimo del [documento maestro](docs/PROYECTO_MAESTRO.md).

## Desarrollo

Node 24 y npm. `npm ci`; copiar `.env.example` a `.env.local` y completar URL y clave publishable. `npm run dev`. Nunca incluir service_role en variables públicas.

`npm test` ejecuta las pruebas del motor y estadísticas; `npm run typecheck` revisa TypeScript; `npm run build` genera el build Next.js.

## Base de datos

Aplicar `supabase/migrations/*.sql` en orden. El script `supabase/seed.sql` está destinado al esquema original: en una base nueva, cargarlo después de 001/002 y antes de la migración de propiedad. La migración asigna los torneos existentes al organizador original verificado. No ejecutar de nuevo el seed en producción.

La edición guarda un agregado versionado y su proyección normalizada en una sola transacción. Los snapshots de edición son privados; las lecturas usan `list_tournaments()`. Las proyecciones, auditoría y Storage tienen RLS por torneo. La propiedad deriva del UID autenticado. El rol member no otorga administración global. Las funciones privadas de autorización no usan user_metadata.

`tests/database.sql` prueba el aislamiento usando cuentas sintéticas, sin correos reales y con rollback completo. Incluye espectadores, propietarios, colaboradores, privacidad, verificación de correo, nombres, permisos por cuenta, revocación y concurrencia.

## Autenticación con verificación de correo

Confirm email está activado en Supabase Authentication → Sign In / Providers. El registro requiere nombre, apellido, correo y contraseña de al menos 8 caracteres. Hay que confirmar el enlace recibido antes del primer ingreso. La base también exige email_confirmed_at para acceder a torneos. Las cuentas que ya estaban confirmadas conservan su acceso.

El proveedor de correo integrado tiene límites de envío y restricciones de destinatarios. Configurar SMTP propio para abrir el registro al público general. No se ha comprobado la recepción en una casilla externa.

Los colaboradores se autorizan por el código UUID de Mi cuenta. Solo el propietario puede otorgar o revocar permisos, que quedan vinculados a la cuenta concreta.

## Despliegue

El repositorio GitHub está conectado al proyecto Vercel gestor-torneos. Node 24, framework Next.js, región gru1. Variables NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. No configurar outputDirectory. Aplicar migraciones de permisos antes de publicar esta versión. Supabase está en sa-east-1; no se modifica ningún recurso del proyecto FOCOemergency.

## Alcance y limitaciones

Implementado: registro e ingreso obligatorio, espectadores registrados, propiedad por torneo, públicos/privados, colaboradores administrados solo por propietario, auditoría, configuración de torneos, equipos/planteles, round robin y BYE/interzonales, canchas simultáneas, rotación, turnos equilibrados, bloqueos, resultados/eventos/correcciones, posiciones, goleadores, disciplina informativa, filtros, historial, WhatsApp, impresión y manifest.

Pendiente: playoffs, múltiples categorías/fases por torneo, catálogo global reutilizable, escudos/fotos desde UI, gestión completa de sanciones, disponibilidad distinta por cancha/fecha, optimización por intercambios, reprogramación excepcional de fechas, SEO por torneo y offline PWA.

El equilibrio de horarios usa una heurística determinista, no garantiza el óptimo global. Desempate directo: comparación entre dos equipos; no minitablas multilaterales. Los eventos de goles pueden cargarse parcialmente pero no superar el marcador. Las sanciones no se cumplen automáticamente. La proyección se reconstruye al guardar: no introducir sanciones manualmente fuera de la app hasta implementar su flujo incremental.
