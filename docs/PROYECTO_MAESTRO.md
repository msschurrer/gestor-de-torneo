# GESTOR DE TORNEOS — PROYECTO MAESTRO
Versión 1.0 | 7 de noviembre de 2026

## 0. INSTRUCCIÓN PARA EL AGENTE DESARROLLADOR
Construí una aplicación web real y ejecutable llamada `gestor-torneos`, independiente de cualquier otro proyecto. Este documento es la especificación de producto y técnica. No te limites a diseñar pantallas o responder con un plan: implementá código, migraciones, tests, datos de demostración y guía de despliegue. Priorizá un MVP operativo de punta a punta y después las mejoras. No afirmes que se creó, desplegó o probó algo sin evidencia. Si no hay acceso a GitHub, Supabase o Vercel, generá el repositorio completo y las instrucciones de conexión, sin inventar credenciales ni proyectos. Ante decisiones no especificadas, usá valores configurables y documentá los supuestos. No vuelvas a preguntar por requisitos ya definidos aquí.

## 1. VISIÓN
Web app responsive/PWA para gestionar múltiples torneos de fútbol locales. Uno o dos administradores autorizados pueden crear y gestionar todos los torneos. Público, jugadores, delegados y espectadores consultan información publicada sin cuenta. Torneos y temporadas históricos permanecen consultables. La aplicación no está atada a un campeonato, formato, número de equipos o cancha particular.

## 2. MODELO DE ACCESO
- Administración centralizada (modelo A). No existe registro público de organizadores ni autoservicio para crear torneos.
- Superadministrador inicial y posibilidad de habilitar un segundo administrador mediante invitación segura.
- Autenticación con Supabase Auth. Roles y autorización definidos en tabla privada/segura o `app_metadata` administrado por servidor; nunca confiar en `user_metadata` editable.
- Público: solo lectura de torneos publicados y datos expresamente públicos. Borradores, datos privados, operaciones y auditoría no se exponen.
- Auditoría de creación, edición, eliminación lógica y publicación, con usuario, fecha y valores relevantes.

## 3. STACK
- Next.js (App Router), TypeScript, React, Tailwind CSS, componentes accesibles.
- Supabase PostgreSQL + Auth + Storage (escudos/fotos). Row Level Security en todas las tablas expuestas; políticas de lectura pública selectiva y escritura solo a administradores.
- Vercel para hosting y despliegue. GitHub como repositorio nuevo e independiente.
- Validación de entradas con Zod; formularios robustos; operaciones transaccionales en backend/base de datos.
- No publicar service-role/secret key en el navegador. Configurar variables de entorno y `.env.example` sin secretos.
- Responsive mobile-first, interfaz en español (Argentina), zona horaria America/Argentina/Cordoba o configurable por torneo; almacenar instantes en UTC y mostrar zona local. Accesibilidad y navegación por teclado.
- Preparación para PWA instalable (manifest, iconos, estrategias de caché seguras); no exigir app nativa.

## 4. MÓDULOS PÚBLICOS
- Inicio: torneos activos, próximos partidos, últimos resultados, enlaces a torneos anteriores.
- Página de torneo con portada, descripción, estado, reglamento, categorías y fases.
- Fixture por fecha, zona, cancha, equipo; horarios locales, partidos simultáneos, libres e interzonales identificados.
- Resultados y detalle de partido: equipos, marcador, fecha, cancha, goles con autor/minuto, tarjetas, observaciones publicables.
- Tabla de posiciones por zona y fase: PJ, PG, PE, PP, GF, GC, DG, puntos; desempates configurados.
- Goleadores y disciplina por torneo/categoría/fase según reglas; fichas de equipos y jugadores, respetando privacidad.
- Eliminatorias/cuadro de playoffs cuando corresponda; historial por temporada.
- Compartir enlaces por WhatsApp; enlaces públicos legibles y SEO básico.

## 5. MÓDULOS PRIVADOS
- Dashboard con torneos, fechas pendientes, partidos por cargar, alertas.
- Asistente Crear torneo: nombre, temporada, logo/imagen opcional, descripción, reglamento, estado borrador/publicado/activo/finalizado/archivado; categorías, cantidad de equipos (variable), zonas y distribución, fases, formato liga/zonas+playoffs/eliminación/personalizado; ida o ida y vuelta; puntuación y desempates; reglas de interzonales; tarjetas/suspensiones; sedes/canchas, días, turnos, duración, buffers, simultaneidad, modo de rotación.
- ABM equipos (escudo, nombre, datos de delegado opcionales y privados), jugadores (nombre, dorsal, ficha), inscripción por torneo, planteles y elegibilidad por torneo/temporada.
- Editor de zonas y fases; generador de cruces, calendario, revisión de conflictos y publicación; edición manual.
- Carga de resultado y eventos, anulación/corrección con auditoría; sanciones y estado de cumplimiento.
- Revisión de equilibrio por equipo: número de turnos 1/2/último, distribución por cancha, descansos, rivales, localías si se usan.
- Recalcular asignaciones de cancha/horario SIN cambiar enfrentamientos; respetar partidos bloqueados/publicados cuando se configure.

## 6. MOTOR DE FIXTURES — REQUISITOS CENTRALES
### 6.1 Separación en dos motores
A) Generador de enfrentamientos por fase/zona (quién juega contra quién y en qué jornada lógica).
B) Planificador de recursos (fecha calendario, turno, cancha), sin alterar emparejamientos. Esta separación es obligatoria.

### 6.2 Zonas y equipos impares
- Cantidad y tamaños de zonas variables, asignación automática o manual.
- Round robin interno por zona, ida o ida/vuelta. Usar algoritmo de círculo con comodín BYE para grupos impares; cada equipo se enfrenta con cada rival el número configurado de veces.
- Ejemplo 10 equipos: Zona A 5, Zona B 5. Cada jornada lógica tiene 2 partidos internos por zona y un equipo potencialmente libre por zona. Si se activa `cruce_interzonal_de_libres`, los dos libres se enfrentan (total 5 partidos). Deben rotarse rivales interzonales evitando repeticiones cuando sea factible. El motor no debe prometer automáticamente un interzonal único contra cada rival: depende del número de fechas y restricciones.
- Ejemplo 11 equipos: Zona A 5, Zona B 6. Zona A: 2 partidos + 1 libre; Zona B: 3 partidos. El libre de A descansa (5 partidos totales) salvo regla adicional explícita.
- Para números arbitrarios de zonas: emparejar libres de zonas diferentes de forma configurable; los que no tengan pareja descansan. Nunca emparejar dos veces al mismo equipo en una fecha.
- Interzonales: opción de que sumen puntos a la tabla de cada equipo en su zona o que sean exhibición; configurar si goles/tarjetas cuentan en rankings. La tabla debe reflejar claramente el criterio.
- Si el formato produce desigualdad en PJ, indicar claramente el efecto y ofrecer criterio de desempate/puntos por partido opcional, nunca aplicarlo sin configuración.
- En fases eliminatorias: byes, cabezas de serie, cruces, ida/vuelta y definición de desempates configurables; no asumir reglas de penales o ventaja deportiva.

### 6.3 Canchas y simultaneidad
- Número de canchas variable por torneo y opcionalmente por fecha; canchas con nombre, sede, disponibilidad y bloqueos.
- Partidos simultáneos en canchas distintas. Ninguna cancha admite dos partidos superpuestos, considerando duración y buffer; ningún equipo juega dos partidos superpuestos.
- Modos configurables: (1) rotación por zonas entre canchas por fecha; (2) distribución libre equilibrada; (3) manual.
- En modo rotación por zonas: ej. fecha 1 Zona A cancha 1 / Zona B cancha 2; fecha 2 intercambian. Interzonales se asignan a cancha disponible, sin violar restricciones. Si una fecha no puede cumplir rotación exacta, mostrar advertencia y mejor solución factible.
- Si hay más zonas que canchas, adaptar asignación por bloques/turnos; no asumir una cancha exclusiva por zona.

### 6.4 Horarios equitativos
- Turnos variables por fecha y cancha; fechas, duración y buffers configurables.
- Si un equipo jugó en el último turno de su fecha anterior, priorizar turno 1 o 2 en su siguiente partido, siempre que sea viable. No es garantía absoluta: se optimiza considerando a AMBOS equipos y disponibilidad.
- Minimizar repeticiones consecutivas de últimos turnos; equilibrar cantidad total de primeros, segundos y últimos turnos por equipo, y también uso de canchas.
- Para equipo libre, comparar contra su último partido efectivamente jugado, no contra la fecha inmediatamente anterior.
- Aplicar optimización por costos ponderados con restricciones duras (sin solapamientos, disponibilidad, bloqueos) y blandas (equidad, alternancia). Usar búsqueda determinista con semilla y heurística de intercambio o solver si disponible; ofrecer explicaciones y puntajes de equidad.
- Priorizar en este orden: integridad deportiva y ausencia de conflictos; restricciones de sede/cancha/fecha; respeto a bloqueos manuales; equilibrio de horarios y canchas.
- Un fixture puede generarse como borrador, validarse, modificarse y publicarse. Cambios posteriores deben advertir al administrador y quedar auditados.

### 6.5 Validación antes de publicar
- Sin equipos duplicados en un mismo partido; sin doble programación de equipos, canchas o árbitros si luego se incorpora módulo.
- Sin partidos fuera de disponibilidad; sin partidos faltantes/duplicados respecto del formato; descanso y número de PJ por equipo informados.
- Reporte de equidad por equipo (turnos y canchas), anomalías y justificación de excepciones.
- Operación de regeneración solo de horarios/canchas, manteniendo cruces y partidos bloqueados.

## 7. MODELO DE DATOS PROPUESTO (MÍNIMO)
`profiles` (user_id PK FK auth.users, role enum admin, enabled, created_at)
`tournaments` (id, slug unique, name, season, description, status, timezone, public_at, settings jsonb validado, created_at, updated_at)
`categories` (id, tournament_id, name, sort_order)
`phases` (id, category_id, name, type, order, settings jsonb)
`groups` (id, phase_id, name, sort_order)
`teams` (id, name, slug, crest_path, created_at)
`players` (id, display_name, created_at; datos personales adicionales solo si son necesarios y con acceso restringido)
`tournament_teams` (id, tournament_id, category_id, team_id, group_id nullable, status; unique por categoría/torneo/equipo)
`roster_entries` (id, tournament_team_id, player_id, jersey_number, status, valid_from, valid_to)
`venues` (id, name, address nullable)
`pitches` (id, venue_id, name, active)
`matchdays` (id, phase_id, round_number, scheduled_date, status)
`matches` (id, phase_id, group_id nullable, matchday_id, home_tournament_team_id, away_tournament_team_id, kind internal/interzonal/playoff, pitch_id nullable, starts_at nullable, duration_minutes, status, home_score, away_score, published_at, locked_at, version)
`match_events` (id, match_id, team_id, player_id nullable, type goal/own_goal/yellow/red/second_yellow, minute nullable, details, voided_at nullable)
`sanctions` (id, roster_entry_id, tournament_id, reason, games_total, games_served, status, imposed_at)
`fixture_runs` (id, tournament_id, phase_id, seed, constraints jsonb, score jsonb, generated_at, status)
`audit_logs` (id, actor_user_id, entity_type, entity_id, action, before_json, after_json, created_at)

Diseñar índices, claves foráneas, restricciones únicas, check constraints, índices de consultas públicas, timestamps y soft-delete donde corresponda. El motor debe usar identificadores de inscripción, no solo `team_id`, para evitar mezclar temporadas y categorías. Para un jugador en varios torneos, las estadísticas se atribuyen a su inscripción correspondiente. No guardar posiciones como fuente de verdad: calcular a partir de partidos finalizados publicados y configuración vigente, con vistas seguras o agregaciones cacheadas invalidables.

## 8. REGLAS DE NEGOCIO Y EDICIÓN
- Puntuación: 3/1/0 por defecto, editable al crear torneo. Criterios de desempate ordenables: puntos, DG, GF, enfrentamiento directo, etc.; implementar únicamente los elegidos y documentar el orden.
- Partidos con estado: programado, en juego (opcional), finalizado, suspendido, postergado, cancelado. Solo partidos finalizados y publicados afectan tablas.
- Goles propios, en contra y eventos anulados correctamente diferenciados. Tarjetas acumuladas y suspensiones según reglamento de torneo, sin inventar cumplimiento automático si hay situaciones ambiguas.
- Transacciones atómicas al finalizar/corregir partido; validaciones del lado servidor, control de concurrencia/versionado para dos administradores.
- Los resultados publicados pueden corregirse, pero se preserva auditoría. Cambios de configuración que alteren estadísticas exigen confirmación y recálculo.
- Protección de datos de jugadores: portal muestra únicamente nombre deportivo y estadísticas pertinentes; no exponer teléfonos, DNI, fechas de nacimiento ni datos sensibles.

## 9. RUTAS SUGERIDAS
Públicas: `/`, `/torneos`, `/torneos/[slug]`, `/torneos/[slug]/fixture`, `/torneos/[slug]/posiciones`, `/torneos/[slug]/goleadores`, `/torneos/[slug]/disciplina`, `/torneos/[slug]/equipos`, `/partidos/[id]`.
Privadas: `/admin/login`, `/admin`, `/admin/torneos/nuevo`, `/admin/torneos/[id]/configuracion`, `/admin/torneos/[id]/equipos`, `/admin/torneos/[id]/fixture`, `/admin/partidos/[id]`, `/admin/catalogo/equipos`, `/admin/catalogo/jugadores`, `/admin/auditoria`.

## 10. UX Y DISEÑO
- Identidad provisional «Gestor de Torneos»; estética deportiva profesional, limpia, sin depender de escudos ajenos. Colores sugeridos azul noche, blanco y verde acento, configurables.
- Mobile-first: tarjetas de resultados, filtros claros, tablas horizontales accesibles en celular, navegación simple.
- Panel administrativo con wizard por pasos, estados vacíos útiles, confirmación antes de publicar, mensajes de error precisos, carga rápida de eventos de partido.
- Mostrar fecha/hora local, sede/cancha, zona y condición de interzonal/libre en cada partido.
- Datos demo claramente marcados como ficticios.

## 11. CASOS DE PRUEBA OBLIGATORIOS
1. 10 equipos en 2 zonas de 5, ida, interzonales activados: por fecha 4 internos + 1 interzonal; cada equipo juega como máximo una vez; no hay libres sin emparejar en ese caso.
2. 11 equipos en zonas de 5 y 6: por fecha 2+3 internos; exactamente 1 libre en zona de 5; ningún interzonal automático sin pareja.
3. 8 equipos en 2 zonas de 4: 4 internos por jornada y ningún libre.
4. 5 equipos en una zona: round robin completo de 5 jornadas, 2 partidos por jornada y 1 libre; cada pareja juega exactamente una vez.
5. Dos canchas y tres turnos: partidos simultáneos permitidos en canchas distintas; imposible duplicar cancha/turno o equipo.
6. Rotación por zonas entre dos canchas en fechas sucesivas; interzonal asignado sin conflictos.
7. Equipo que jugó último turno: se prioriza temprano en siguiente partido; medir penalización si es imposible por rival/restricciones.
8. Regeneración de horarios mantiene pares de rivales, jornadas lógicas y partidos bloqueados.
9. Corrección de marcador/eventos recalcula tabla y goleadores sin duplicar eventos.
10. Usuario anónimo no puede escribir; administrador autenticado puede; segundo usuario sin permiso no puede.
11. Borrador no aparece en portal público; torneo publicado sí.
12. Suspensiones, goles en contra, empate y desempates configurados probados.
13. Fixtures deterministas con la misma semilla y configuración.
14. Prueba de concurrencia: dos administradores editan un mismo resultado y se detecta conflicto.

## 12. ORDEN DE IMPLEMENTACIÓN
**Fase 1 — MVP real:** scaffold Next.js, autenticación, migraciones RLS, catálogo equipos/jugadores, creación de torneos/categorías/zonas, inscripción, generador round robin + libres/interzonales, asignación de canchas y turnos, editor de fixture, carga de resultados/eventos, tablas y goleadores públicos, publicación, tests.
**Fase 2 — Operación avanzada:** sanciones, fases eliminatorias, reglas complejas, auditoría enriquecida, reportes de equidad, filtros, exportación/impresión, PWA.
**Fase 3 — Escalado:** notificaciones, estadísticas históricas avanzadas, perfiles delegados solo lectura u otros permisos si se autorizan, branding, dominios.

## 13. ENTREGABLES EXIGIDOS AL AGENTE
- Repositorio completo con código TypeScript y estructura mantenible.
- SQL/migraciones para Supabase con RLS, índices, políticas y seed de torneo ficticio 10 equipos/2 zonas/2 canchas.
- `.env.example`, README con instalación, scripts de ejecución, pruebas y despliegue Vercel.
- Tests unitarios del motor de fixture y tablas; al menos un test de integración de flujo torneo → fixture → resultado → posiciones.
- Evidencia de build/test; capturas o preview cuando la herramienta lo permita.
- Lista explícita de lo implementado, lo pendiente, limitaciones y pasos que requieren intervención del propietario.
- No tocar proyectos ni recursos de FOCOemergency.

## 14. CRITERIOS DE ACEPTACIÓN DEL MVP
Una persona autorizada puede iniciar sesión, crear torneo de 10 equipos dividido en dos zonas de 5, inscribir equipos y jugadores, configurar dos canchas y turnos, generar y revisar un fixture que incluye los interzonales de libres, publicarlo, cargar un resultado con goles y tarjetas, y observar actualización correcta de resultados, posiciones y goleadores desde un navegador anónimo. Debe poder generar otro torneo distinto (p. ej. 11 equipos en zonas 5+6) sin cambios de código. Debe poder reordenar horarios/canchas sin cambiar cruces. Seguridad, tests y documentación verificables.

## 15. PROMPT DE ARRANQUE RECOMENDADO
«Actuá como equipo senior de producto, arquitectura y desarrollo full-stack. Usá el archivo PROYECTO MAESTRO adjunto como fuente de requisitos. Construí ahora la primera versión ejecutable de `gestor-torneos`, independiente de FOCOemergency. No me devuelvas solo un plan ni maquetas: implementá el proyecto, la base de datos, el motor de fixture, el panel y el portal público, con tests y README. Trabajá por hitos verificables y avanzá hasta el MVP; preguntame únicamente cuando falten credenciales, permisos o una decisión verdaderamente bloqueante. Si podés conectar GitHub/Supabase/Vercel, verificá el destino antes de crear recursos y mantenelos separados de otros proyectos. Reportá con precisión qué está creado y qué falta.»
