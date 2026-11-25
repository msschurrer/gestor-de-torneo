import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sanctionState,playerEligibility,disciplinaryTable} from '../lib/sanctions';
import {defaultSettings,uid,type Sanction} from '../lib/types';
import {pairings} from '../lib/engine';
import {demoTournament} from '../lib/demo';
import {tournamentSchema} from '../lib/validation';
const base:Sanction={id:uid(),teamId:uid(),playerId:uid(),kind:'games',reason:'Resolución',startRound:2,games:3,servedRounds:[],amount:1000,paid:false,cancelled:false};
test('suspensión cumple fechas confirmadas anteriores, nunca la fecha en curso',()=>{assert.match(sanctionState({...base,servedRounds:[2,3]},4),/1 fecha/);assert.match(sanctionState({...base,servedRounds:[2,3,4]},4),/1 fecha/);assert.equal(sanctionState({...base,servedRounds:[2,3,4]},5),'Cumplida');});
test('pagar multa redimible habilita la fecha siguiente, sin borrar sanciones concurrentes',()=>{const s={...base,kind:'redeemable' as const,paid:true,paidAfterRound:2};assert.match(sanctionState(s,2),/Suspendido/);assert.equal(sanctionState(s,3),'Habilitado por pago');const t=demoTournament();t.sanctions=[s,{...base,id:uid(),kind:'ban'}];assert.equal(playerEligibility(t,base.teamId,base.playerId,3).eligible,false);assert.equal(sanctionState({...s,paid:false},3).startsWith('Suspendido'),true);});
test('multa impaga inhabilita, sanción de fechas no se elimina pagando y anulación conserva historia',()=>{assert.match(sanctionState({...base,kind:'fine'},5),/Inhabilitado/);assert.match(sanctionState({...base,paid:true,paidAfterRound:1},3),/Suspendido/);assert.equal(sanctionState({...base,cancelled:true},3),'Anulada');});
function teams(n:number){return Array.from({length:n},(_,i)=>({id:uid(),name:String(i),group:i%2,players:[]}));}
test('13 equipos: zona 7+6, ningún interzonal con equipos que ya terminaron su zona',()=>{for(const interzonal of [true,false]){const es=teams(13),ms=pairings(es,{...defaultSettings,interzonal,equalMatches:false});assert.equal(ms.length,36);assert(ms.every(m=>m.kind==='internal'));assert(es.filter(e=>e.group===0).every(e=>ms.filter(m=>[m.home,m.away].includes(e.id)).length===6));assert(es.filter(e=>e.group===1).every(e=>ms.filter(m=>[m.home,m.away].includes(e.id)).length===5));}});
test('dos zonas impares permiten activar o desactivar el cruce entre libres',()=>{const es=teams(10);const no=pairings(es,{...defaultSettings,interzonal:false}),yes=pairings(es,{...defaultSettings,interzonal:true});assert.equal(no.length,20);assert.equal(yes.length,25);assert.equal(yes.filter(m=>m.kind==='interzonal').length,5);});
test('validación conserva sanción y rechaza cumplir una fecha libre o jugador ajeno',()=>{const t=demoTournament(),e=t.entrants[0];t.sanctions=[{...base,teamId:e.id,playerId:e.players[0].id,servedRounds:[]}];assert.equal(tournamentSchema.parse(t).sanctions!.length,1);t.sanctions[0].servedRounds=[999];assert.equal(tournamentSchema.safeParse(t).success,false);t.sanctions[0].servedRounds=[];t.sanctions[0].playerId=uid();assert.equal(tournamentSchema.safeParse(t).success,false);});
test('resolución fija fecha de regreso sin anular otra sanción vigente',()=>{const s={...base,reinstatedRound:5};assert.match(sanctionState(s,4),/Suspendido/);assert.equal(sanctionState(s,5),'Habilitado por resolución');const t=demoTournament();t.sanctions=[s,{...base,id:uid(),kind:'ban'}];assert.equal(playerEligibility(t,s.teamId,s.playerId,5).eligible,false);});
test('no se permite habilitar una expulsión del torneo con una fecha de regreso',()=>{const t=demoTournament(),e=t.entrants[0];t.sanctions=[{...base,teamId:e.id,playerId:e.players[0].id,kind:'ban',reinstatedRound:5}];assert.equal(tournamentSchema.safeParse(t).success,false);t.sanctions[0].kind='games';assert.equal(tournamentSchema.safeParse(t).success,true);t.sanctions[0].reinstatedRound=2;assert.equal(tournamentSchema.safeParse(t).success,false);});

test('una expulsión se resuelve una sola vez en la tabla y una doble amarilla se distingue de la roja directa',()=>{
 const t=demoTournament(),m=t.matches[0],team=t.entrants.find(e=>e.id===m.home)!;
 const player=team.players[0],eventId=uid();
 t.matches=[{...m,status:'finished',published:true,events:[
  {id:uid(),teamId:team.id,playerId:player.id,type:'yellow',minute:15},
  {id:eventId,teamId:team.id,playerId:player.id,type:'second_yellow',minute:25},
  {id:uid(),teamId:team.id,playerId:player.id,type:'red',minute:26,voided:true}
 ]}];
 t.sanctions=[];
 const row=disciplinaryTable(t)[0];
 assert.deepEqual([row.yellow,row.red,row.secondYellow,row.pending[0].id],[2,0,1,eventId]);
 t.sanctions=[{...base,teamId:team.id,playerId:player.id,sourceEventId:eventId}];
 assert.equal(disciplinaryTable(t)[0].pending.length,0);
 assert.equal(tournamentSchema.parse(t).sanctions![0].sourceEventId,eventId);
});

test('la multa habilita desde la siguiente fecha o la suspensión se cumple con el partido siguiente del equipo',()=>{
 const t=demoTournament(),m=t.matches[0],team=t.entrants.find(e=>e.id===m.home)!;
 const s:Sanction={...base,teamId:team.id,playerId:team.players[0].id,kind:'redeemable',games:1,startRound:2};
 t.sanctions=[s];
 t.matches=[{...m,round:2,status:'postponed',published:true,events:[]},{...m,round:4,status:'finished',published:true,events:[]}];
 assert.equal(playerEligibility(t,s.teamId,s.playerId,4).eligible,false);
 assert.equal(playerEligibility(t,s.teamId,s.playerId,5).eligible,true);
 assert.deepEqual(s.servedRounds,[]);
 t.sanctions=[{...s,paid:true,paidAfterRound:2}];
 assert.equal(playerEligibility(t,s.teamId,s.playerId,2).eligible,false);
 assert.equal(playerEligibility(t,s.teamId,s.playerId,3).eligible,true);
 t.sanctions=[{...s,kind:'fine'}];
 assert.equal(playerEligibility(t,s.teamId,s.playerId,5).eligible,false);
});

test('administración muestra tarjetas guardadas sin marcador y la vista pública espera el resultado',()=>{
 const t=demoTournament(),m=t.matches[0],team=t.entrants.find(e=>e.id===m.home)!;
 const player=team.players[0];
 t.sanctions=[];
 t.matches=[{...m,status:'scheduled',published:true,homeScore:null,awayScore:null,events:[
  {id:uid(),teamId:team.id,playerId:player.id,type:'yellow',minute:15}
 ]}];
 assert.deepEqual(disciplinaryTable(t),[]);
 assert.equal(disciplinaryTable(t,true)[0].yellow,1);
 assert.equal(t.matches[0].homeScore,null);
});
