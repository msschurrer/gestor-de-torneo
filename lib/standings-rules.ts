export const standingCriteria = {
 points:['Puntos','Mayor cantidad de puntos'],
 difference:['Diferencia de goles','Mayor diferencia entre goles a favor y en contra'],
 goals:['Goles a favor','Mayor cantidad de goles convertidos'],
 goalsAgainst:['Goles en contra','Menor cantidad de goles recibidos'],
 won:['Partidos ganados','Mayor cantidad de victorias'],
 lost:['Partidos perdidos','Menor cantidad de derrotas'],
 headToHead:['Enfrentamiento directo','Puntos en una minitabla entre todos los equipos que continúan empatados'],
 yellow:['Tarjetas amarillas','Menos amarillas; la segunda amarilla cuenta como una amarilla adicional'],
 red:['Expulsiones','Menos rojas directas o por segunda amarilla'],
 fairPlay:['Fair play','Menor puntaje: 1 por amarilla y 3 por expulsión; segunda amarilla suma ambos'],
 ppg:['Puntos por partido','Mayor promedio de puntos por partido jugado'],
 winPercentage:['Porcentaje de victorias','Mayor proporción de partidos ganados'],
 goalRatio:['Cociente de goles','Goles a favor divididos por goles en contra; sin goles recibidos y con goles a favor tiene prioridad'],
 draw:['Sorteo','Orden aleatorio realizado por el organizador y conservado al guardar'],
} as const;
export type StandingCriterion=keyof typeof standingCriteria;
