import assert from 'node:assert/strict';
import {test} from 'node:test';
import {PDFDocument} from 'pdf-lib';
import {demoTournament} from '../lib/demo';
import {createSanctionsPdf, sanctionsReport} from '../lib/sanctions-pdf';
import type {Sanction} from '../lib/types';

test('disciplinary PDFs distinguish matchday cards, continuing sanctions and tournament history', async () => {
 const t = demoTournament();
 const match = t.matches[0];
 const team = t.entrants.find(e => e.id === match.home)!;
 const player = team.players[0];
 const event = {id:'red',teamId:team.id,playerId:player.id,type:'red' as const,minute:10};
 t.matches = [
  {...match,round:1,events:[event,{...event,id:'voided',voided:true}]},
  {...match,id:'next',round:3,status:'scheduled',events:[]}
 ];
 const suspension: Sanction = {
  id:'sanction',teamId:team.id,playerId:player.id,sourceEventId:event.id,
  kind:'redeemable',reason:'Expulsión por roja directa',startRound:2,games:2,servedRounds:[],
  amount:100,paid:true,paidAfterRound:3,cancelled:false
 };
 t.sanctions = [suspension];
 assert.equal(sanctionsReport(t,1).cards[0].red,1);
 assert.equal(sanctionsReport(t,1).resolutions.length,1);
 assert.equal(sanctionsReport(t,3).cards.length,0);
 assert.equal(sanctionsReport(t,3).resolutions.length,1);
 assert.equal(sanctionsReport(t,4).resolutions.length,0);
 assert.equal(sanctionsReport(t).resolutions.length,1);
 assert.match((await PDFDocument.load(await createSanctionsPdf(t,3))).getTitle()!,/Fecha 3/);
 t.sanctions = Array.from({length:20},(_,i)=>({...suspension,id:String(i),reason:'Motivo extenso. '.repeat(65)}));
 const history = await PDFDocument.load(await createSanctionsPdf(t));
 assert.match(history.getTitle()!,/Torneo completo/);
 assert(history.getPageCount()>1);
});
