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
