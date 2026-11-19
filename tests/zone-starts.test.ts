import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultSettings,uid,type Settings} from '../lib/types';
import {pairings,schedule,validateFixture} from '../lib/engine';
const teams=(sizes:number[])=>sizes.flatMap((n,group)=>Array.from({length:n},(_,i)=>({id:uid(),name:`Equipo ${group}-${i}`,group,players:[]})));
const settings=(mode:Settings['mode']='rotation'):Settings=>({...defaultSettings,mode,groups:2,interzonal:false,strictByes:true,equalMatches:false,autoSchedule:true,duration:40,halftime:5,buffer:10,roundCalendar:Array.from({length:7},(_,i)=>({round:i+1,date:`2026-12-${String(i*3+1).padStart(2,'0')}`,startTime:'20:30'}))});
for(const mode of ['rotation','balanced'] as const)for(const sizes of [[6,5],[5,5],[6,7]])test(`${mode} ${sizes.join('+')}: ambas zonas arrancan juntas y no hay huecos de cancha`,()=>{
 for(const seed of [1,2,42,89]){
 const s={...settings(mode),seed},input=pairings(teams(sizes),s),ms=schedule(input,s).matches;assert.deepEqual(validateFixture(ms,s),[]);
 for(const round of new Set(ms.map(m=>m.round))){const day=ms.filter(m=>m.round===round);for(const group of [0,1]){const zone=day.filter(m=>m.group===group);if(!zone.length)continue;assert.equal(Math.min(...zone.map(m=>m.slot)),0);assert.equal(zone.find(m=>m.slot===0)!.startsAt,`2026-12-${String((round-1)*3+1).padStart(2,'0')}T23:30:00.000Z`);}
 for(const pitch of s.pitches){const slots=day.filter(m=>m.pitch===pitch).map(m=>m.slot).sort((a,b)=>a-b);assert.deepEqual(slots,slots.map((_,i)=>i));}}
 assert.deepEqual(ms.map(m=>[m.id,m.round,m.home,m.away]),input.map(m=>[m.id,m.round,m.home,m.away]));
 }
});
test('una sola cancha mantiene partidos sucesivos sin superposiciones',()=>{const s={...settings(),pitches:['Única']},ms=schedule(pairings(teams([6,5]),s),s).matches;assert.deepEqual(validateFixture(ms,s),[]);assert.equal(ms.filter(m=>m.round===1&&m.slot===0).length,1);});
test('al reequilibrar se conservan los bloqueados y los resultados',()=>{
 const s=settings(),ms=schedule(pairings(teams([6,5]),s),s).matches;const first=ms.find(m=>m.round===2&&m.group===0&&m.slot===0)!;first.status='finished';first.homeScore=1;first.awayScore=0;
 const before=structuredClone(first),next=schedule(ms,s).matches;assert.deepEqual(next.find(m=>m.id===first.id),before);assert.deepEqual(validateFixture(next,s),[]);
});
