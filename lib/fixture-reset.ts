import type {Tournament} from './types';
// Reset only an unplayed fixture. A partial score, voided event or note is still data.
export function fixtureHasRecordedData(t:Pick<Tournament,'matches'>):boolean{
 return t.matches.some(m=>m.status==='finished'||m.homeScore!==null||m.awayScore!==null||m.homePenalties!=null||m.awayPenalties!=null||!!m.winnerId||m.events.length>0||m.note.trim().length>0);
}
export function removeGeneratedFixture(t:Tournament):Tournament{
 if(fixtureHasRecordedData(t))throw Error('El fixture tiene resultados, goles, tarjetas u observaciones cargados. No se puede eliminar sin perder ese historial.');
 return {...t,matches:[],settings:{...t.settings,roundCalendar:[]}};
}
