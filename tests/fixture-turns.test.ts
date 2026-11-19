import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchStart,pairings,schedule,validateFixture} from '../lib/engine';
import {changeFixtureTurn} from '../lib/fixture-turns';
import {demoTournament} from '../lib/demo';
import {defaultSettings} from '../lib/types';

function fixture() {
 const t = demoTournament();
 t.entrants = Array.from({length:11},(_,i)=>({id:'team-'+i,name:'Equipo '+i,group:i<6?0:1,players:[]}));
 t.settings = {...defaultSettings,seed:70,interzonal:false,strictByes:true,equalMatches:false,autoSchedule:true,
  roundCalendar:Array.from({length:5},(_,i)=>({round:i+1,date:'2026-12-0'+(i+1),startTime:'20:30'}))};
 t.matches = schedule(pairings(t.entrants,t.settings),t.settings).matches;
 return t;
}

test('intercambia horarios de una zona sin cambiar los cruces ni el inicio simultáneo',()=>{
 const t = fixture();
 const first = t.matches.find(m=>m.round===2&&m.group===0&&m.slot===0)!;
 const last = t.matches.find(m=>m.round===2&&m.group===0&&m.slot===2)!;
 const changed = changeFixtureTurn(t,first.id,{matchId:last.id});
 assert.equal(changed.find(m=>m.id===first.id)!.startsAt,last.startsAt);
 assert.equal(changed.find(m=>m.id===last.id)!.startsAt,first.startsAt);
 assert.deepEqual(changed.map(m=>[m.id,m.home,m.away]),t.matches.map(m=>[m.id,m.home,m.away]));
 assert.equal(first.slot,0);
 assert.deepEqual(validateFixture(changed,t.settings),[]);
 const otherZone = t.matches.find(m=>m.round===2&&m.group===1&&m.slot===1)!;
 assert.throws(()=>changeFixtureTurn(t,first.id,{matchId:otherZone.id}),/misma fecha y zona/);
 last.locked = true;
 assert.throws(()=>changeFixtureTurn(t,first.id,{matchId:last.id}),/desbloqueado/);
});

test('mueve un partido a un turno libre y rechaza cruces de cancha o aperturas desfasadas',()=>{
 const t = fixture();
 const match = t.matches.find(m=>m.round===2&&m.group===1&&m.slot===1)!;
 const changed = changeFixtureTurn(t,match.id,{slot:2});
 assert.equal(changed.find(m=>m.id===match.id)!.startsAt,matchStart(t.settings,2,2,t.matches));
 assert.throws(()=>changeFixtureTurn(t,match.id,{slot:0}),/ocupado/);
 const opener = t.matches.find(m=>m.round===2&&m.group===1&&m.slot===0)!;
 assert.throws(()=>changeFixtureTurn(t,opener.id,{slot:2}),/inicio simultáneo/);
});

test('la rotación distribuye el cierre entre equipos en el fixture que antes repetía tres cierres',()=>{
 const t = fixture();
 const closing = t.matches.filter(m=>m.slot===2);
 for (const team of t.entrants) {
  assert(closing.filter(m=>m.home===team.id||m.away===team.id).length<=2,team.name);
 }
});
