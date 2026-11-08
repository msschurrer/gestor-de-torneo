# Modelo vigente: registro con contraseña y correo verificado

Actualización del 8 de noviembre de 2026: se vuelve a exigir la confirmación del correo.

Todos ingresan con una cuenta. El registro pide nombre, apellido, correo y contraseña. El correo es el usuario para iniciar sesión, con confirmación por enlace antes del primer ingreso. Supabase Auth conserva el hash de la contraseña; los datos deportivos nunca contienen contraseñas. Nombre y apellido se almacenan en profiles para presentación, sin usarse como autorización.

Cualquier miembro puede crear un torneo y queda como propietario. Los torneos publicados públicos son visibles para todas las cuentas registradas. Los privados y borradores solo son visibles para el propietario y sus colaboradores. La administración no es global. El propietario es el único que puede cambiar privacidad y dar o quitar permisos.

La autorización sigue vinculada a la cuenta concreta: el propietario recibe el código de usuario de una cuenta ya registrada, la busca y confirma el nombre, correo declarado y código antes de autorizarla. La concesión corresponde a ese user_id; otra persona que escriba un correo no recibe accesos automáticamente. Las concesiones antiguas activas conservan su UID. Los registros pendientes antiguos se conservan sin activación automática y el endpoint anterior por email queda revocado.

Los colaboradores tienen edición deportiva completa en su torneo, sin delegación ni cambios de privacidad. La revocación es lógica, inmediata en las siguientes operaciones, y auditada. Las políticas RLS, los snapshots privados y los controles transaccionales/versionados se mantienen. Los espectadores siguen sin poder editar ni consultar torneos privados.

Mi cuenta permite completar los nombres existentes, copiar el código de usuario y definir contraseña desde una sesión autenticada. Para quienes antes usaban magic link, esa sesión permite pasar al acceso con contraseña sin enviar correo. No hay recuperación automática de contraseña por un correo no verificado. La asistencia para cuentas sin sesión ni contraseña debe comprobar la identidad por otro canal; no se usa la dirección declarada como prueba.

## Configuración y pruebas

Supabase Authentication → Sign In / Providers: Email habilitado, Allow new users to sign up habilitado, Confirm email activado. No habilitar anonymous sign-ins. La URL principal y /admin permanecen configuradas. Para registros generales se requiere SMTP propio; el servicio integrado limita envíos y destinatarios.

`npm test`: motor deportivo y validación. `npm run build`: TypeScript y Next.js. `tests/database.sql`: prueba aislada con rollback de perfiles con nombre, rechazo de acceso sin correo confirmado, propietarios, espectadores, privacidad, metadata falsa, permisos por cuenta, prohibición de delegar, revocación y conflictos. La migración final agrega el modelo sin eliminar tablas ni registros antiguos.
