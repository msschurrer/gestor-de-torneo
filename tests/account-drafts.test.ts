import {test} from 'node:test';
import assert from 'node:assert/strict';
import {draftStore,writeDraft,readDraft} from '../lib/editor-drafts';
import {capturePendingOwner,pendingOwner,forgetPendingOwner} from '../lib/pending-access';
import {demoTournament} from '../lib/demo';
function storage(){const data:Record<string,string>={};return new Proxy(data,{get(target,key){if(key==='getItem')return(k:string)=>target[k]??null;if(key==='setItem')return(k:string,v:string)=>{target[k]=String(v);};if(key==='removeItem')return(k:string)=>{delete target[k];};return Reflect.get(target,key);}});}
const a='10000000-0000-4000-a000-000000000001',b='10000000-0000-4000-a000-000000000002';
test('borradores, marcadores y datos del partido quedan separados por cuenta en el mismo navegador',()=>{
 Object.defineProperty(globalThis,'localStorage',{value:storage(),configurable:true});const first=draftStore(a),second=draftStore(b),t={...demoTournament(),version:0};
 first.writeDraft({tournament:t,step:2,names:'Equipo privado pendiente',dirty:true,savedAt:'2026-11-09'});first.writeInputDraft(t.id,'score-one',{home:'3',away:'1'});first.writeInputDraft(t.id,'info-one',{note:'Borrador privado'});
 assert.equal(first.currentNewDraftId(),t.id);assert.equal(second.currentNewDraftId(),null);assert.deepEqual(second.allDrafts(),[]);assert.equal(second.readDraft(t.id),null);assert.equal(second.readInputDraft(t.id,'score-one'),null);assert.equal(second.readInputDraft(t.id,'info-one'),null);
 second.writeInputDraft(t.id,'score-one',{home:'0',away:'0'});assert.deepEqual(first.readInputDraft(t.id,'score-one'),{home:'3',away:'1'});second.startNewDraft();second.clearDraft(t.id);assert(first.readDraft(t.id));assert.equal(first.allDrafts().length,1);
});
test('una respuesta tardía ligada a la cuenta original no escribe en los borradores de otra cuenta',()=>{
 Object.defineProperty(globalThis,'localStorage',{value:storage(),configurable:true});const original=draftStore(a),next=draftStore(b),t={...demoTournament(),version:0};
 original.writeDraft({tournament:t,step:1,names:'',dirty:true,savedAt:''});next.writeDraft({tournament:{...t,name:'Otro borrador'},step:2,names:'',dirty:true,savedAt:''});
 original.clearDraft(t.id);assert.equal(original.readDraft(t.id),null);assert.equal(next.readDraft(t.id)!.tournament.name,'Otro borrador');
});
test('los borradores antiguos se conservan sin adjudicarse automáticamente a una cuenta nueva',()=>{
 Object.defineProperty(globalThis,'localStorage',{value:storage(),configurable:true});const t={...demoTournament(),version:0};writeDraft({tournament:t,step:1,names:'Anterior',dirty:true,savedAt:''});assert.equal(draftStore(a).readDraft(t.id),null);assert.equal(readDraft(t.id)!.names,'Anterior');
});
test('el enlace original de creador sobrevive al ingreso y solo se elimina después de vincular',()=>{
 Object.defineProperty(globalThis,'sessionStorage',{value:storage(),configurable:true});const id=demoTournament().id,key='a'.repeat(64);
 assert(capturePendingOwner(id,'#access='+key));assert.equal(pendingOwner(id),key);assert.equal(capturePendingOwner(id,''),false);assert.equal(pendingOwner(id),key);assert.equal(pendingOwner('20000000-0000-4000-a000-000000000099'),'');
 assert.equal(capturePendingOwner('nuevo','#access='+key),false);assert.equal(capturePendingOwner(id,'#access=incorrecto'),false);assert.equal(pendingOwner(id),key);forgetPendingOwner(id);assert.equal(pendingOwner(id),'');
});
