import assert from 'node:assert/strict';
import {test} from 'node:test';
import {demoTournament} from '../lib/demo';
import {upcomingRound} from '../lib/upcoming-round';

test('el resumen muestra toda la próxima fecha publicada, en orden y sin límite de cuatro partidos',()=>{
 const match = demoTournament().matches[0];
 const round = Array.from({length:5},(_,i)=>({
  ...match,id:'fecha-2-'+i,round:2,slot:i,published:true,
  startsAt:'2026-12-02T'+(18+i)+':00:00Z',
  status:i===0?'finished' as const:'scheduled' as const
 }));
 const matches = [
  {...match,id:'later',round:3,startsAt:'2026-12-03T18:00:00Z',published:true,status:'scheduled' as const},
  {...round[0],id:'private',published:false},
  ...[...round].reverse()
 ];
 assert.deepEqual(upcomingRound(matches).map(item=>item.id),round.map(item=>item.id));
 assert.deepEqual(upcomingRound([round[0]]),[]);
});
