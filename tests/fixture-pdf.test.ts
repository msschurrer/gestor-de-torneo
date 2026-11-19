import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {createFixturePdf} from '../lib/fixture-pdf';
import {demoTournament} from '../lib/demo';
import {pairings,schedule} from '../lib/engine';
import {uid} from '../lib/types';
function sample(sizes=[6,5]){const t=demoTournament();t.name='Torneo Doña Marta';t.settings={...t.settings,groups:sizes.length,legs:1,equalMatches:false,strictByes:true,interzonal:false,autoSchedule:true,roundCalendar:[]};t.entrants=sizes.flatMap((size,group)=>Array.from({length:size},(_,i)=>({id:uid(),name:`Equipo ${group}-${i} de la localidad`,group,players:[]})));t.matches=schedule(pairings(t.entrants,t.settings),t.settings).matches;return t;}
test('descarga fixture completo de 11 equipos en una sola hoja A4, sin modificar el torneo',async()=>{
 const t=sample(),before=structuredClone(t),bytes=await createFixturePdf(t);const pdf=await PDFDocument.load(bytes);
 assert.equal(pdf.getPageCount(),1);assert.match(pdf.getTitle()||'',/Doña Marta/);const {width,height}=pdf.getPage(0).getSize();assert(Math.abs(width*height-595.28*841.89)<1);assert.deepEqual(t,before);assert.equal(t.matches.length,25);
});
test('PDF admite nombres largos, fechas pendientes, penales y más jornadas en una sola hoja',async()=>{
 const t=sample([6,7]);t.name='Copa de la localidad 🏆';t.entrants[0].name='Asociación Deportiva Ñandú - un equipo con un nombre extenso';t.matches.push({...t.matches[0],id:uid(),round:8,kind:'playoff',playoffStage:0,status:'finished',homeScore:1,awayScore:1,homePenalties:4,awayPenalties:3});t.settings.playoffs={enabled:true,size:8,seeding:'cross'};
 const pdf=await PDFDocument.load(await createFixturePdf(t));assert.equal(pdf.getPageCount(),1);
});
test('no genera un documento vacío cuando no existe fixture',async()=>{const t=sample();t.matches=[];await assert.rejects(createFixturePdf(t),/Todavía no hay/);});
