# Orden configurable de posiciones

El creador elige una lista de criterios únicos y su prioridad mediante Agregar, Subir, Bajar y Quitar en Configuración. No se fuerza que Puntos sea primero. Los criterios se aplican sucesivamente solo al subconjunto que continúa empatado. El desempate directo utiliza puntos en una minitabla de todos los equipos empatados en ese nivel, evitando comparadores cíclicos entre pares.

Criterios: puntos, diferencia de goles, goles a favor, menos goles en contra, victorias, menos derrotas, enfrentamiento directo, menos amarillas, menos expulsiones, fair play, puntos por partido, porcentaje de victorias, cociente de goles y sorteo. Fair play suma 1 por amarilla y 3 por expulsión; una segunda amarilla cuenta en ambas categorías, igual que el ranking existente. Solo intervienen partidos de fase inicial finalizados y publicados, e interzonales cuando suman puntos. No se cuentan eventos anulados ni eliminatorias.

El sorteo se realiza explícitamente en el editor, requiere dos equipos, pide confirmación al regenerarlo, utiliza aleatoriedad criptográfica y persiste una permutación de IDs al guardar. Agregar equipos después requiere completar un nuevo sorteo antes de generar cruces. Recargar no sortea. Si todos los criterios empatan y no hay sorteo que los separe, el orden alfabético es provisional. No se afirma resolución definitiva de un empate reglamentario sin criterios suficientes.

Se conservan configuraciones anteriores. Los torneos nuevos usan el orden elegido también para la clasificación general. Los anteriores que no tengan `customStandings` conservan el orden general histórico por PPP hasta modificar su configuración. Los cruces ya generados no se alteran silenciosamente; la validación rechaza un cambio incompatible con clasificados existentes.

Al guardar, servidor y cliente recalculan el orden derivado. La proyección pública recibe solo los IDs ordenados dentro de settings; así respeta tarjetas ocultas sin publicar eventos disciplinarios ni sus cantidades. El administrador calcula con los eventos completos. No se necesita migración SQL ni modificar datos de torneos existentes.

Validación: 77 pruebas, incluyendo prioridades, minitablas, disciplina oculta, sorteo, interzonales, clasificación y compatibilidad. La revisión visual debe efectuarse en el entorno de desarrollo antes de publicar.
