# Modelo vigente de acceso — 7 de noviembre de 2026

Esta decisión del propietario reemplaza los apartados de acceso público sin cuenta y administración centralizada del documento maestro original.

Todos se registran e ingresan para consultar torneos. Se conserva la verificación de correo para identificar al propietario y vincular permisos por email de forma segura. Los usuarios confirmados reciben un perfil de miembro sin privilegios globales.

Cada miembro puede crear torneos. PostgreSQL asigna su propietario usando `auth.uid()`, nunca datos enviados por el navegador. Los torneos públicos publicados son visibles para todos los miembros. Los privados y los borradores son visibles únicamente para su propietario y colaboradores. Un enlace no da acceso a un torneo privado.

El propietario administra el torneo y su privacidad. Puede habilitar o revocar colaboradores desde la pestaña Accesos de ese torneo. Los colaboradores tienen edición deportiva completa, incluidos fixture, equipos, resultados y eventos. No pueden transferir propiedad, cambiar privacidad, ver el listado de correos de colaboradores ni otorgar o revocar permisos. Los permisos no se heredan entre torneos.

El propietario carga el correo exacto de la persona. Si ya existe una cuenta confirmada, el permiso se activa inmediatamente. De otro modo queda pendiente hasta que ese correo se confirme. No se envían invitaciones automáticas ni se presume que una dirección escrita por un tercero está verificada. El organizador comunica el acceso por su canal habitual.

La pestaña Mis torneos muestra los torneos propios y las colaboraciones. Torneos muestra todos los campeonatos publicados que la cuenta puede consultar. Los cambios deportivos y los permisos quedan auditados. Las revocaciones se comprueban en la base en cada operación; un editor con una pestaña vieja no puede continuar guardando después de perder acceso.

## Seguridad

El documento de edición no se puede seleccionar directamente desde la API. Un RPC invoker llama a un lector privado que devuelve solamente las filas permitidas y los partidos publicados para espectadores. Los ayudantes de autorización con privilegios elevados están en un esquema privado, usan search_path vacío y verifican la cuenta real y su perfil habilitado. No existe acceso deportivo anónimo. Las proyecciones relacionales y Storage se protegen por el mismo torneo.

La propiedad es inmutable desde la aplicación y desde REST. No se confía en user_metadata ni en el campo access del cliente. La escritura sigue siendo transaccional y versionada. La Copa Encuentro preexistente se asigna al organizador inicial verificado durante la migración.

## Correo

La aplicación incluye registro con correo/contraseña, ingreso con contraseña y enlace de acceso para cuentas existentes. La URL de retorno es /admin en el dominio publicado, configurada en Supabase. Para habilitar registro y confirmaciones a cualquier destinatario, configurar SMTP propio en Supabase: el servicio incorporado tiene restricciones de destinatarios y frecuencia. No desactivar la verificación de email para solucionar la entrega, porque los permisos se vinculan a correos confirmados.

## Verificación

`npm test`: motor deportivo y estadísticas.
`npm run build`: TypeScript y build Next.
`tests/database.sql`: cuentas sintéticas en una transacción con rollback; registro, propietario automático, bloqueo anónimo, públicos para miembros, privacidad, metadata falsa, aislamiento de edición, colaboraciones, invitación pendiente, verificación, revocación y conflictos de versión.
