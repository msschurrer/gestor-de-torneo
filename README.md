# Gestor de Torneos

Aplicación independiente de FOCOemergency. Next.js 16 App Router, React, TypeScript, Tailwind CSS 4, Zod y Supabase PostgreSQL/Auth/Storage. Hosting Vercel.

## Desarrollo

Node 24, npm. `npm ci`, copiar `.env.example` a `.env.local` y completar URL y clave **publishable**. `npm run dev`. `npm test` ejecuta 16 casos del motor/estadísticas, `npm run typecheck` verifica TypeScript y `npm run build` produce el build de Next. Nunca configurar una clave service role en una variable pública.

## Base de datos

Ejecutar por orden `supabase/migrations/*.sql` y después `supabase/seed.sql` una sola vez. `tests/database.sql` prueba permisos, borradores, escritura admin, conflictos de versión y no duplicación; todo se revierte con ROLLBACK. El seed contiene una Copa Encuentro ficticia: 10 equipos, 2 zonas, 2 canchas, 25 partidos y 5 resultados.

Se guarda un agregado versionado de cada torneo para edición atómica y una proyección normalizada en categorías, fases, zonas, equipos, jugadores, inscripciones, planteles, sedes, canchas, fechas, partidos y eventos dentro de la misma transacción. Las tablas tienen RLS, claves e índices. El snapshot privado no es seleccionable desde la API pública: `list_tournaments()` entrega al público solamente torneos y partidos publicados. Ningún dato sensible de jugadores se recoge. El historial de auditoría almacena snapshots antes/después sin permisos de edición del cliente.

Límite MVP: equipos y jugadores son registros por torneo; el catálogo global reutilizable y categorías múltiples en un mismo torneo requieren evolución del agregado. Una categoría y fase de liga por torneo. Las tablas de sanciones y fixture_runs están preparadas, pero no tienen aún flujo operativo. El agregado reescribe su proyección deportiva al guardar: no usar sanciones manuales fuera de la aplicación hasta completar su migración incremental.

## Primer administrador (obligatorio)

En Supabase Authentication → URL Configuration, configurar Site URL con la URL final de Vercel y permitir `https://TU-DOMINIO/admin` como Redirect URL. La interfaz de acceso permite enlace seguro por correo o contraseña existente. Para producción configurar SMTP propio: el correo de prueba incorporado de Supabase puede limitar destinatarios y frecuencia.

`private.admin_allowlist` contiene la cuenta del propietario obtenida de GitHub (`msschurrer@gmail.com`). Solo tras verificar el correo, el trigger crea `profiles`. No hay registro público de organizadores y una cuenta autenticada sin perfil no obtiene permisos. Antes de usar otro correo, el propietario debe agregarlo de forma explícita mediante SQL. Para un segundo administrador: agregar su correo a la allowlist y enviarle una invitación desde Authentication → Users (máximo dos administradores operativos recomendado). No dar permiso al cliente para editar perfiles. Para revocar: `update public.profiles set enabled=false where user_id='ID';`. El estado enabled se verifica en base de datos en cada operación, no depende de metadata editable ni de claims de rol antiguos.

## Operación

1. Ingresar en `/admin` con una cuenta habilitada.
2. Crear un torneo: nombre, enlace, temporada, categoría, reglas, zonas, puntaje, interzonales, canchas, turnos, duración, buffer y calendario.
3. Agregar equipos uno por línea y jugadores con nombre deportivo/dorsal. Ajustar zonas antes de generar.
4. Generar fixture. El motor de círculo/BYE determina cruces y un planificador independiente determina recursos con semilla determinista y costos de equidad.
5. Revisar conflictos y reporte de turnos/canchas. Bloquear partidos y reequilibrar sin cambiar cruces. Editar cancha/turno manualmente si hace falta; las inconsistencias bloquean el guardado.
6. Guardar y publicar desde Equidad y publicación. Los borradores son privados.
7. Cargar marcadores/eventos. Solo resultados finalizados publicados alteran posiciones y rankings. Los eventos pueden ser parciales y sus goles no pueden superar el marcador. Los goles en contra benefician al rival en la validación y no cuentan como goles del autor. Los eventos anulados se conservan sin contarse.
8. Compartir el enlace público por WhatsApp. El público ve fixture con filtros, tablas, goleadores, disciplina, equipos y reglamento.

Los resultados se corrigen guardando una versión nueva con auditoría. Un torneo editado por dos administradores rechaza el segundo guardado si usa la misma versión. Las modificaciones de formato se bloquean cuando ya hay fixture para proteger resultados; se puede crear otro torneo con reglas diferentes.

## Equidad

Restricciones duras: una participación por equipo por fecha, cancha y equipo sin superposición incluida duración+buffer, capacidad y turnos configurados, respeto de bloqueos. La rotación por zona tiene un costo mayor que las preferencias de horario. Se penaliza último turno repetido, repetición del mismo turno y desequilibrio acumulado por cancha/turno, considerando ambos rivales. El historial considera el último partido efectivo después de un libre. Es una heurística determinista voraz, no una prueba de óptimo global ni garantía de equidad perfecta. Las excepciones y el reporte por equipo permiten revisar el resultado.

Desempate directo MVP: comparación entre los dos equipos empatados; no implementa minitablas multilaterales. Para grupos con empates múltiples se recomienda puntos/DG/GF hasta incorporar el reglamento avanzado. La igualdad absoluta usa nombre para orden visual, sin implicar ventaja deportiva.

## Vercel y GitHub

Repositorio del propietario: `msschurrer/gestor-de-torneo`. Conectarlo a un proyecto nuevo Vercel con framework Next.js y Node 24. Variables NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. `npm run build`, sin outputDirectory personalizado. La app pública requiere desactivar la protección SSO de producción; la administración conserva Supabase Auth + autorización RLS. Región de funciones gru1, base sa-east-1.

Despliegue inicial: proyecto Supabase `cjgzqrwvqjubkucxzmwd`, proyecto Vercel `prj_GNwpOyp8qIhcwYKJEIEzLL5sMvBO`. Ningún recurso existente de FOCOemergency fue modificado.

La primera publicación se realizó directamente por API Vercel. El repositorio mantiene el código y su historial; verificar la conexión Git en Vercel para despliegues automáticos.

## Alcance y pendientes

Implementado: administración central, autenticación, autorización y auditoría, creación/configuración, equipos/planteles, round robin ida/vuelta, BYE/interzonales, horarios simultáneos, rotación/equidad, edición y bloqueos, publicación, resultados/eventos/correcciones, posiciones, rankings, disciplina informativa, histórico, filtros, WhatsApp, impresión, manifest e icono.

Pendiente: playoffs/cuadros eliminatorios, editor de múltiples fases/categorías por torneo, catálogo global compartido, fotos/escudos desde UI (bucket listo), sanciones y cumplimiento administrado, invitación del segundo admin desde UI, disponibilidad/bloqueos por cancha/fecha, optimización por intercambios, reprogramación excepcional de fechas por partido, SEO de cada torneo con datos SSR, PWA offline y notificaciones. El manifest prepara instalación, pero no se implementa caché offline para no exponer datos privados ni resultados obsoletos.

La seguridad SQL y los tests del motor se verificaron. El recorrido autenticado con correo real del propietario requiere configurar URL de Auth/SMTP y completar su primer ingreso. No se simula ese acceso ni se exponen credenciales.
