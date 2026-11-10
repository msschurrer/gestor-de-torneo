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
2. Obtener un respaldo verificable de esquema, datos y cuentas de la producción, fuera del repositorio; ensayar recuperación y registrar su ubicación privada. El inventario de cantidades anterior NO es un respaldo. Aún no se obtuvo ese respaldo.
3. Confirmar la configuración de SMTP y las direcciones de Auth del proyecto de PRODUCCIÓN. El correo solo se configuró y verificó en pruebas. Cualquier contraseña SMTP debe introducirla el usuario directamente, sin copiarla al repositorio, chat o logs.
4. Mantener las cuentas independientes: no copiar contraseñas ni trasladar usuarios de pruebas automáticamente. El usuario tendrá que utilizar o crear una cuenta confirmada en producción.
5. Bloquear temporalmente escrituras durante el cambio coordinado y conservar la consulta pública.
6. Desplegar el código validado con las variables de producción. Comprobar schemaVersion 2, registro, confirmación, lectura pública, creador y rechazo de acceso ajeno; cotejar cantidades e integridad antes de reabrir administración.

## Reversión

Un fallo SQL antes del commit debe revertirse transaccionalmente. Después del commit, no deshacerlo borrando cuentas, propietarios ni invitaciones. Suspender escrituras, conservar consulta y preparar corrección compatible. No promover el frontend anterior de enlaces como rollback sin comprobar su compatibilidad con permisos retirados. Restaurar backup solo tras ensayo y conciliación de cualquier cambio posterior.

## Respaldo parcial y ensayo completados

Se guardó fuera del repositorio una instantánea consistente de las 20 tablas public/private, definiciones de funciones, columnas, restricciones, políticas, índices y permisos, con referencias de cuentas sin credenciales. SHA-256: `5bd6645d9f19ae928ee4f83c960d6b9dcf7639d81b58e4a68d482e1bc863be76`. Se verificaron estructura y cantidades, y se restauró en PostgreSQL en memoria aislado. La migración de cuentas preservó íntegros todos los documentos de torneo y los conteos deportivos.

Comando: `node scripts/verify-backup-local.mjs /ruta/privada/snapshot.json`. Este script no se conecta a Supabase ni a otra base externa y nunca debe adjuntar el snapshot al repositorio o a artefactos públicos de CI. Los datos reales no se copiaron al proyecto alojado de pruebas.

Alcance limitado: no es pg_dump completo. No incluye contraseñas, sesiones, configuración SMTP ni archivos Storage. Continúa pendiente el respaldo completo de Auth/configuración y la configuración/verificación SMTP de producción. No dar por satisfecha la condición de respaldo completo ni ejecutar publicación automáticamente por haber pasado este ensayo.
