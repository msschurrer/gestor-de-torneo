# Revisión de publicación de cuentas y permisos

## Estado revisado

La producción sigue en el commit `6acc802199b8a6c0fef49e3ef52c3497d02ffcf2` y el despliegue `dpl_99RRgVcvjvteVoCHDCDeKDTSgHpc`. Inspección de solo lectura: 11 torneos, 85 equipos, 227 partidos y 3 cuentas; 10 torneos sin titular asociado. `platform_action` aún no existe en producción. No se modificó producción.

Desarrollo: `feature/platform-accounts-invitations`, PR #1. Pruebas alojadas en el proyecto independiente `sdsvfbquylrxbyykoyld`; producción usa `cjgzqrwvqjubkucxzmwd`. Las variables de preview de la rama tienen una conexión específica al proyecto de pruebas; no trasladar esas variables a producción.

## Cambios que se someterán a autorización

Aplicar exclusivamente `supabase/migrations/20261108224333_platform_accounts_and_invitations.sql` a producción, en su transacción, y publicar el frontend compatible. No volver a aplicar todas las migraciones históricas ni el baseline. La actualización agrega invitaciones de un uso, permisos por cuenta y torneo, auditoría y herramientas de supervisión. Retira las escrituras y las lecturas privadas mediante antiguos enlaces. Los torneos anteriores requieren vinculación desde una cuenta confirmada y el secreto original del creador. No se asignarán automáticamente los torneos sin titular.

La consulta pública permanece sin autenticación y respeta privacidad y disciplina. El creador administra acceso, publicación y datos; el colaborador actual edita datos deportivos del torneo asignado y no puede delegar. La separación adicional entre administrador completo y encargado de resultados no está implementada en esta versión y debe tratarse como actualización posterior, no anunciarla como disponible.

No borrar torneos, equipos, partidos ni cuentas. No asignar superadministrador durante esta publicación: el usuario debe confirmar la cuenta y autorizar la asignación por separado. No contratar servicios ni crear ramas alojadas de Supabase.

## Evidencia de pruebas

- 66 pruebas de aplicación y TypeScript aprobados tras corregir el aviso de recuperación que convivía con errores.
- GitHub Actions ejecutó Supabase local y correo Mailpit con registro, confirmación, sesiones, invitación, revocación y compilación aprobados.
- Prueba transaccional en el proyecto de pruebas: creador, rechazo de ajenos, aceptación, edición del invitado, rechazo de delegación, revocación y rechazo anónimo. Rollback completo y cero usuarios ficticios remanentes.
- Comprobación en pruebas: ni anon ni authenticated pueden actualizar directamente tournaments; anon no tiene EXECUTE sobre platform_action; no hay superadministradores asignados.
- Usuario confirmó registro y recepción de correos de confirmación y recuperación después de corregir el host SMTP a smtp.gmail.com.
- Detalles de apariencia diferidos por decisión del usuario. No afirmar prueba visual completa de todos los permisos ni prueba simultánea entre dispositivos.

## Condiciones previas a ejecutar

1. Autorización explícita de migración y publicación, tras mostrar este alcance.
2. Obtener un respaldo verificable de esquema, datos y cuentas de la producción, fuera del repositorio; ensayar recuperación y registrar su ubicación privada. El inventario de cantidades anterior NO es un respaldo. Se completó la copia de datos deportivos y una copia privada de recuperación de cuentas, con ensayos aislados descritos abajo. No equivalen a pg_dump completo ni respaldo de configuración administrada.
3. Confirmar la configuración de SMTP y las direcciones de Auth del proyecto de PRODUCCIÓN. SMTP también quedó configurado en producción: solicitud de recuperación respondió HTTP 200 y el usuario confirmó recepción en Outlook. Falta comprobar las URL de Auth definitivas en la ventana de publicación. Cualquier contraseña SMTP debe introducirla el usuario directamente, sin copiarla al repositorio, chat o logs.
4. Mantener las cuentas independientes: no copiar contraseñas ni trasladar usuarios de pruebas automáticamente. El usuario tendrá que utilizar o crear una cuenta confirmada en producción.
5. Bloquear temporalmente escrituras durante el cambio coordinado y conservar la consulta pública.
6. Desplegar el código validado con las variables de producción. Comprobar schemaVersion 2, registro, confirmación, lectura pública, creador y rechazo de acceso ajeno; cotejar cantidades e integridad antes de reabrir administración.

## Reversión

Un fallo SQL antes del commit debe revertirse transaccionalmente. Después del commit, no deshacerlo borrando cuentas, propietarios ni invitaciones. Suspender escrituras, conservar consulta y preparar corrección compatible. No promover el frontend anterior de enlaces como rollback sin comprobar su compatibilidad con permisos retirados. Restaurar backup solo tras ensayo y conciliación de cualquier cambio posterior.

## Respaldo parcial y ensayo completados

Se guardó fuera del repositorio una instantánea consistente de las 20 tablas public/private, definiciones de funciones, columnas, restricciones, políticas, índices y permisos, con referencias de cuentas sin credenciales. SHA-256: `5bd6645d9f19ae928ee4f83c960d6b9dcf7639d81b58e4a68d482e1bc863be76`. Se verificaron estructura y cantidades, y se restauró en PostgreSQL en memoria aislado. La migración de cuentas preservó íntegros todos los documentos de torneo y los conteos deportivos.

Comando: `node scripts/verify-backup-local.mjs /ruta/privada/snapshot.json`. Este script no se conecta a Supabase ni a otra base externa y nunca debe adjuntar el snapshot al repositorio o a artefactos públicos de CI. Los datos reales no se copiaron al proyecto alojado de pruebas.

Alcance limitado: no es pg_dump completo. No incluye contraseñas, sesiones, configuración SMTP ni archivos Storage. Continúa pendiente el respaldo completo de Auth/configuración y la configuración/verificación SMTP de producción. No dar por satisfecha la condición de respaldo completo ni ejecutar publicación automáticamente por haber pasado este ensayo.

## Cuentas y correo de producción verificados

Se creó una copia privada de recuperación de las tres cuentas y sus tres identidades, con datos de contraseña cifrados por hash, sin sesiones, refresh tokens, códigos de un uso ni claves SMTP. Se restauró únicamente en PostgreSQL en memoria, comprobando igualdad de ID, email y hash y las referencias entre identidades y usuarios. No se modificaron cuentas reales. La revisión del proyecto devolvió cero factores MFA y cero objetos Storage.

Verificador reproducible: `node scripts/verify-account-backup-local.mjs /ruta/privada/cuentas.json`. Nunca adjuntar copias de cuentas a CI, commits, issues ni enlaces públicos. No es una copia completa de Supabase Auth ni de la configuración de proveedores. Una recuperación de estas copias puede requerir nuevo inicio de sesión; debe ensayarse y coordinarse antes de cualquier restauración real. La actualización propuesta no modifica auth.users, auth.identities ni las claves SMTP.

El usuario corrigió las credenciales SMTP del proyecto definitivo; una solicitud de recuperación respondió 200 y confirmó recepción del correo en Outlook. No volver a solicitar envíos en bucle. Mantener el SMTP y sus credenciales en el panel; verificar Site URL y allowlist exacta de producción sin copiar claves al código.

La autorización solicitada comprende aplicar exclusivamente la migración de cuentas preparada, desplegar el frontend compatible con la conexión original de producción y ajustar las direcciones de retorno de Auth al dominio definitivo. No comprende asignación de superadministrador, borrado de datos, importación de usuarios de pruebas ni contratación de servicios. Registrar el SHA aprobado y detenerse ante diferencias o fallos; refrescar las copias si hubo cambios reales antes de la ventana.
