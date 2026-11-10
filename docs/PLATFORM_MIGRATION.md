# Cuentas, invitaciones y plataforma — actualización preparada

## Diagnóstico verificado el 8 de noviembre de 2026

Next.js 16 / React 19 / TypeScript, Supabase/Postgres, GitHub y Vercel. Se conserva el motor deportivo, el documento JSON transaccional y sus proyecciones relacionales. Producción contiene 11 torneos, 85 equipos y 227 partidos; 10 torneos no tienen propietario asociado a una cuenta. No se modificaron esos datos durante este trabajo.

El sistema anterior usa enlaces permanentes con secretos del creador o colaborador. Existen implementaciones anteriores de cuentas, perfiles, políticas por torneo y auditoría que se reutilizan. La implementación desplegada contiene ajustes SQL que no estaban íntegramente en las migraciones locales; `supabase/baselines/20261108_live_functions.sql` captura solo definiciones de funciones para reproducirlas en las pruebas, sin datos ni secretos. No es una migración que deba ejecutarse sobre producción.

## Modelo actualizado

- Consulta pública sin cuenta, exclusivamente mediante la proyección pública que respeta privacidad y disciplina.
- Correo como usuario y contraseña gestionada por Supabase Auth. Se mantiene la confirmación de correo. No se incorpora un servicio de contraseñas propio.
- Propietario `tournaments.owner_id`; miembros por torneo reutilizan `private.tournament_collaborators` y su flag `enabled`.
- Los invitados aceptan con una cuenta personal de correo y contraseña, sin compartir credenciales del creador. Alternativa elegida a WebAuthn/passkey: evita implementar un flujo incompleto de registro y recuperación de passkeys. Pueden usar una cuenta existente o crear una durante la activación; no necesitan completar un registro de organizador distinto.
- Invitaciones de un solo uso: 32 bytes aleatorios, solo SHA-256 almacenado en la base, vencimiento configurable de 1–30 días, validación y consumo bajo bloqueo transaccional. La URL usa fragmento, eliminado al abrirla. El token se conserva temporalmente en sessionStorage solo mientras se termina el ingreso y se borra al aceptar. La invitación concede un permiso vinculado a la cuenta, no un enlace permanente de edición.
- Creador/superadministrador administra invitaciones, revoca miembros, publica, cambia privacidad, transfiere y elimina de forma recuperable. Colaboradores gestionan datos deportivos.
- El superadministrador usa `private.platform_roles`, inaccesible desde el registro y desde REST. Nunca se toma el rol de user_metadata.
- Suspender un perfil bloquea cada llamada posterior aunque su JWT no haya vencido. Revocar colaboración bloquea ese torneo en sesiones ya abiertas. El usuario puede cerrar todas sus sesiones desde el menú.
- Las lecturas y escrituras privadas pasan por `platform_action` y verifican el usuario en API, función SQL y helpers de autorización. Se retiran las rutas alternativas de escritura por enlaces, lecturas de snapshots antiguos y accesos REST a tablas deportivas que podrían eludir la proyección de disciplina.
- Se conserva la auditoría transaccional con actor, fecha, snapshot anterior y posterior; se agregan eventos de invitaciones, cambios de miembros, transferencias y suspensión.

## Datos deportivos

Se conservan zonas variables, libres, interzonales opcionales, rotación, programación por fecha, canchas simultáneas, clasificación, cruces y penales. Los cálculos públicos se derivan del mismo snapshot guardado y conservan el refresco de 15 segundos.

Según el documento nuevo, modificar eventos de gol recalcula el marcador (incluyendo goles en contra y anulaciones). Confirmar el resultado sigue realizándose en la tarjeta principal. Las tarjetas y observaciones no cambian el marcador.

Nueva opción de reglamento: sanción automática por cada acumulación de amarillas, con límite existente y fechas configurables. Se genera al guardar partidos confirmados, sin duplicados al guardar otra vez. Corregir eventos cancela la sanción derivada que deja de corresponder. Las expulsiones continúan bajo resolución manual: el documento no define una cantidad automática de fechas para ellas. Los torneos anteriores conservan la opción desactivada hasta que el organizador la habilite.

## Vinculación de torneos anteriores

No se adjudican torneos al primer usuario ni al superadministrador automáticamente. El creador ingresa a su cuenta y abre el enlace antiguo. Puede pulsar Vincular torneo antiguo: el servidor exige que el torneo no tenga titular y que la credencial antigua sea de creador. Al completar la vinculación conserva íntegramente el documento deportivo y deshabilita todos los enlaces antiguos de ese torneo. Los colaboradores anteriores se vuelven a invitar para asociar cuentas personales. Si ya existe otro propietario, o se perdió el enlace original, debe revisarse y resolverse explícitamente por un responsable autorizado; nunca se asigna por adivinación o correo no verificado.

## Pruebas realizadas y límites

- `npm test`: 66 pruebas deportivas, persistencia local, fixtures, penales, sanciones, goles, actualización de derivados y rechazo de solicitudes API sin credenciales válidas.
- `npm run test:platform`: PostgreSQL aislado con PGlite, migraciones históricas, baseline de funciones inspeccionadas y migración nueva. Comprueba acceso anónimo denegado, dos torneos de un creador, acceso ajeno denegado, invitación/consumo/reutilización, permisos exclusivos por torneo, revocación sobre sesión existente, caducidad, suspensión, rol global, auditoría, bypass REST, promoción de rol, conflicto de versión, vinculación antigua sin pérdida de datos e invalidez de enlaces antiguos.
- `npm run build`: compilación y TypeScript.
- Las pruebas SQL simulan identidades autenticadas y no sustituyen las pruebas reales de Supabase Auth, correo, callbacks, persistencia de sesiones entre dispositivos, carreras simultáneas ni WebAuthn. La suite Auth real ya verificó registro, correo capturado localmente, sesiones, invitación y revocación en Supabase local dentro de GitHub Actions (9 de noviembre de 2026). Quedan por verificar SMTP externo, navegación entre dispositivos y el recorrido visual del navegador.
- No se utiliza ninguna rama alojada ni servicio adicional. La suite SQL corre en PostgreSQL aislado con PGlite y queda configurado Supabase local completo para un equipo con Docker; ver LOCAL_DEVELOPMENT.md. No se modificó producción.

## Publicación coordinada — requiere confirmación

1. Completado en GitHub Actions con Supabase local y Mailpit: `npm run test:auth:local`. Si más adelante se ofrece un proyecto gratuito de ensayo, podrá usarse únicamente con costo cero y configuración separada. Nunca apuntar las pruebas de registro contra producción.
2. Configurar Supabase Auth para registro público con correo y contraseña, Site URL y redirect URLs permitidas (`/admin`, `/admin/torneos/nuevo`, `/invitacion`, `/ingresar?recuperar=1`). Revisar proveedor SMTP y límites de envío. No desactivar verificación automáticamente.
3. No hay bandera de bloqueo del registro. La disponibilidad del editor se detecta por la versión de esquema, mientras que registro, ingreso y recuperación permanecen implementados de forma independiente. Una migración ausente produce un error explícito en la API administrativa, sin otorgar permisos implícitos.
4. Probar registro real de creador, confirmación de correo, creación de varios torneos, ingreso de una segunda cuenta, aceptación, revocación, cierre de sesión, recuperación, reapertura desde otro dispositivo y recorrido público–administración. Revisar apariencia móvil con sesión y sin sesión.
5. Antes de producción, obtener un backup verificado de esquema y datos de public/private y respaldo de identidades de Auth conforme a las herramientas de Supabase, conservado fuera del repositorio. Registrar el commit desplegado y exportar las configuraciones de Auth/Vercel sin imprimir secretos. Ensayar restauración en la base de ensayo.
6. Confirmar explícitamente qué cuenta recibirá superadministración. Asignar en una operación administrativa controlada por UUID de una cuenta confirmada, no por registro público ni por inferir el primer usuario.
7. Tras aprobación, ventana de mantenimiento de escrituras, aplicar la migración dentro de su transacción y desplegar el commit validado. Verificar la detección de la versión del esquema, ejecutar smoke tests y reabrir administración.

## Reversión

La migración es aditiva y transaccional: si falla antes de commit, PostgreSQL revierte todo. No ejecutar una migración inversa que borre usuarios, invitaciones, titulares o documentos deportivos. Ante un fallo posterior, suspender temporalmente las escrituras administrativas y mantener la consulta pública; reponer el frontend anterior solo como consulta mientras se corrige. No reactivar enlaces de colaboradores revocados ni sobrescribir torneos con snapshots viejos. Si se requiere restaurar el backup, hacerlo primero en un entorno separado y conciliar los cambios posteriores antes de la restauración final autorizada.

La versión de producción anterior permanece intacta hasta aprobación; la rama de actualización es una propuesta integrada y verificable, no una migración aplicada.

## Actualización del 9 de noviembre

Se continúa exclusivamente en la rama de desarrollo de GitHub y en entornos locales. No se intentará crear una rama de Supabase ni contratar Pro. No se asignó superadministrador y no se aplicaron migraciones a producción. Los cambios de permisos, invitaciones, vinculación y retirada de endpoints antiguos deben revisarse y autorizarse antes de la migración de producción.

## Revisión adicional de sesiones y recuperación

Se aislaron los borradores locales por cuenta, incluidos marcadores y eventos. Los borradores anteriores permanecen sin asignación automática. Se conserva el secreto del enlace antiguo durante el ingreso para que el creador pueda demostrar titularidad al vincular. Las respuestas de solicitudes de otra cuenta se descartan, se retira el estado de edición al cambiar de identidad y se comprueba la revocación del torneo al volver a la pestaña y cada 15 segundos. No se aplicaron cambios a producción.
