import {test} from 'node:test';
import assert from 'node:assert/strict';
import {demoTournament} from '../lib/demo';
import {removeGeneratedFixture,fixtureHasRecordedData} from '../lib/fixture-reset';
import {prepareTournamentSave} from '../lib/tournament-sync';
import {standings,rankings} from '../lib/engine';
import {tournamentSchema} from '../lib/validation';
function fresh(){const t=demoTournament();return {...t,matches:t.matches.map(m=>({...m,status:'scheduled' as const,homeScore:null,awayScore:null,homePenalties:null,awayPenalties:null,winnerId:undefined,events:[],note:''}))};}
test('eliminar fixture limpia cruces y calendario, conserva torneo y no muta el original',()=>{
 const t=fresh(),snapshot=structuredClone(t);const reset=prepareTournamentSave(removeGeneratedFixture(t));
 assert.equal(reset.matches.length,0);assert.deepEqual(reset.settings.roundCalendar,[]);assert.deepEqual(reset.entrants,t.entrants);assert.equal(reset.rules,t.rules);assert.equal(reset.status,t.status);assert.equal(reset.visibility,t.visibility);assert.equal(reset.version,t.version);assert.deepEqual(t,snapshot);assert.equal(tournamentSchema.safeParse(reset).success,true);
 assert(standings(reset).every(row=>row.played===0));assert(rankings(reset).every(row=>row.goals===0));
});
test('eliminar fixture rechaza datos aun si el partido no está finalizado',()=>{
 const t=fresh();for(const patch of [{status:'finished' as const},{homeScore:0},{awayScore:0},{homePenalties:0},{awayPenalties:0},{winnerId:t.entrants[0].id},{note:'Observación'},{events:[{id:crypto.randomUUID(),teamId:t.entrants[0].id,playerId:t.entrants[0].players[0].id,type:'yellow' as const,minute:5,voided:true}]}]){
 const changed={...t,matches:[{...t.matches[0],...patch}]};assert.equal(fixtureHasRecordedData(changed),true);assert.throws(()=>removeGeneratedFixture(changed),/historial/);
 }
});
