import {PDFDocument, StandardFonts, rgb} from 'pdf-lib';
import {disciplinaryTable, playerEligibility, returnToPlay, sanctionKinds, sanctionState, withCompletedRounds} from './sanctions';
import type {Tournament} from './types';

export function sanctionsReport(t: Tournament, round?: number) {
 const matches = t.matches.filter(match => round === undefined || match.round === round);
 const cards = disciplinaryTable({...t, matches}, true).filter(row => row.yellow || row.red || row.secondYellow);
 const resolutions = (t.sanctions ?? []).map(s => withCompletedRounds(t, s)).filter(s => {
  if (round === undefined || s.startRound === round) return true;
  const state = sanctionState(s, round);
  return state.startsWith('Suspendido') || state.startsWith('Inhabilitado') || state === 'Expulsado del torneo' ||
   matches.some(match => match.events.some(event => !event.voided && event.id === s.sourceEventId));
 }).sort((a,b) => a.startRound - b.startRound);
 return {cards, resolutions};
}

export async function createSanctionsPdf(t: Tournament, round?: number) {
 const {resolutions} = sanctionsReport(t, round);
 const pdf = await PDFDocument.create();
 const regular = await pdf.embedFont(StandardFonts.Helvetica);
 const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
 const supported = new Set(regular.getCharacterSet());
 const clean = (value: string) => Array.from(value.normalize('NFC').replace(/\s+/g,' '), char =>
  supported.has(char.codePointAt(0)!) ? char : ''
 ).join('').trim();
 const width = 595.28, height = 841.89, margin = 36;
 const ink = rgb(.08,.17,.15), green = rgb(.09,.23,.18);
 const title = round === undefined ? 'Disciplina · Torneo completo' : 'Disciplina · Fecha ' + round;
 const referenceRound = round ?? Math.max(1, ...t.matches.filter(m=>m.status==='finished').map(m=>m.round+1));
 let page = pdf.addPage([width,height]), y = height-margin;
 function draw(value: string, size: number, font = regular, color = ink) {
  page.drawText(value,{x:margin,y,size,font,color});
  y -= size+5;
 }
 function newPage() {
  page = pdf.addPage([width,height]);
  y = height-margin;
  draw(title+' (continuación)',12,bold,green);
  y -= 10;
 }
 function paragraph(value: string, size = 10, font = regular) {
  let line = '';
  for (const char of clean(value)) {
   if (line && font.widthOfTextAtSize(line+char,size) > width-margin*2) {
    const breakAt = line.lastIndexOf(' ');
    if (y < margin) newPage();
    draw(breakAt > 0 ? line.slice(0,breakAt) : line,size,font);
    line = (breakAt > 0 ? line.slice(breakAt+1) : '') + char;
   } else line += char;
  }
  if (y < margin) newPage();
  if (line) draw(line.trimStart(),size,font);
 }
 function table(headers: string[], widths: number[], rows: string[][]) {
  function header() {
   page.drawRectangle({x:margin,y:y-24,width:width-margin*2,height:24,color:green});
   let x = margin;
   headers.forEach((label,i) => {
    page.drawText(label,{x:x+5,y:y-15,size:8,font:bold,color:rgb(1,1,1)});
    x += widths[i];
   });
   y -= 24;
  }
  if (y < margin+65) newPage();
  header();
  if (!rows.length) paragraph('Sin registros para este informe.');
  rows.forEach((row,index) => {
   const cells = row.map((value,i) => {
    const lines: string[] = [];
    let line = '';
    for (const char of clean(value)) {
     if (line && regular.widthOfTextAtSize(line+char,9)>widths[i]-10) {
      const space = line.lastIndexOf(' ');
      lines.push(space>0 ? line.slice(0,space) : line);
      line = ((space>0 ? line.slice(space+1) : '')+char).trimStart();
     } else line += char;
    }
    return [...lines,line];
   });
   const lineCount = Math.max(...cells.map(cell=>cell.length));
   const maxPageLines = Math.floor((height-margin*2-70)/12);
   for (let offset=0;offset<lineCount;) {
    const lines = Math.min(maxPageLines,lineCount-offset);
    const rowHeight = lines*12+10;
    if (y-rowHeight < margin) {
     newPage();
     header();
    }
    if (index%2===0) page.drawRectangle({x:margin,y:y-rowHeight,width:width-margin*2,height:rowHeight,color:rgb(.94,.97,.94)});
    let x = margin;
    cells.forEach((cell,i) => {
     cell.slice(offset,offset+lines).forEach((line,j) => {
      page.drawText(line,{x:x+5,y:y-13-j*12,size:9,font:regular,color:ink});
     });
     x += widths[i];
    });
    y -= rowHeight;
    offset += lines;
   }
  });
 }
 paragraph(t.name,18,bold);
 draw(title,12,bold,green);
 if (round === undefined) paragraph('Estado de las resoluciones consultado para la fecha '+referenceRound);
 y -= 16;

 const selected = {...t, matches:t.matches.filter(m=>round===undefined||m.round===round), sanctions:resolutions};
 const rows = disciplinaryTable(selected,true).map(row => {
  const eligibility = playerEligibility(t,row.teamId,row.playerId,referenceRound);
  const pending = row.pending.some(event=>
   !(t.sanctions??[]).some(s=>!s.cancelled&&s.sourceEventId===event.id)
  );
  const state = !eligibility.eligible ? eligibility.reasons.join(' · ') : pending ? 'Expulsión por resolver' : 'Habilitado';
  return [row.player,row.team,String(row.yellow),String(row.red),String(row.secondYellow),state];
 });
 table(['Jugador','Equipo','Amarillas','Rojas directas','Doble amarilla','Estado'],[103,100,47,65,65,width-margin*2-380],rows);

 y -= 24;
 if (y < margin+65) newPage();
 draw('Resoluciones disciplinarias',13,bold,green);
 table(['Jugador','Equipo','Sanción y motivo','Estado y regreso'],[103,100,152,width-margin*2-355],resolutions.map(s => {
  const team = t.entrants.find(e=>e.id===s.teamId);
  const player = team?.players.find(p=>p.id===s.playerId);
  const payment = s.kind==='fine'||s.kind==='redeemable'
   ? s.paid ? ' · Multa pagada después de la fecha '+s.paidAfterRound : ' · Multa pendiente de pago'
   : '';
  return [player?.name??'Jugador',team?.name??'Equipo',
   sanctionKinds[s.kind]+' · Desde fecha '+s.startRound+(s.games ? ' · '+s.games+' fecha(s)' : '')+(s.reason ? ' · '+s.reason : ''),
   sanctionState(s,referenceRound)+' · '+returnToPlay(s)+payment];
 }));
 pdf.setTitle(clean(t.name)+' - '+title);
 return pdf.save();
}
