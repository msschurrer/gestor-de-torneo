# Reglamento PDF — revisión antes de producción

Rama de desarrollo: `dev/reglamento-pdf`.

El organizador adjunta/reemplaza/quita un PDF desde Configuración y confirma el cambio al guardar el torneo. El visitante lo lee y descarga en Reglamento. El texto del reglamento se conserva. Primero debe existir un torneo guardado.

## Migración pendiente de autorización

`20261110042615_tournament_rules_pdf.sql` crea únicamente:

- Bucket privado `tournament-rules`, PDF, límite 4 MiB.
- Dos funciones privadas de autorización y políticas Storage SELECT/INSERT.
- Carga exclusiva para propietarios y colaboradores con permiso de edición vigente.
- Lectura pública exclusivamente del PDF asociado a un torneo público fuera de borrador.

No modifica torneos, cuentas, resultados ni otros buckets. No requiere plan Pro. La producción permanece sin cambios hasta autorización explícita.

Los archivos son inmutables y se reemplazan mediante una ruta aleatoria nueva. Los anteriores dejan de estar disponibles al público al guardar el reemplazo o quitar el adjunto. Se retienen en almacenamiento privado para evitar borrar un archivo usado por un guardado concurrente; una futura limpieza puede retirar los huérfanos. No se emiten enlaces firmados duraderos: cada lectura comprueba permisos actuales. Las copias que un visitante ya haya descargado no se pueden retirar.

## Validación

- Pruebas unitarias: contenido PDF, MIME/extensión, límite, nombre seguro, rutas y API sin autenticación.
- Suite PostgreSQL aislada: acceso público/privado/borrador, propietario, cuenta ajena y revocación de PDF reemplazado.
- Integración Supabase local en CI: carga y descarga reales vía Storage y cambios de privacidad/reemplazo.
- Compilación Next.js y TypeScript.
- Migración aplicada solamente al proyecto gratuito de pruebas `sdsvfbquylrxbyykoyld`; asesores sin nuevos hallazgos asociados al cambio.
