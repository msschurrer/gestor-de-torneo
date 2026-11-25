import {PDFDocument, StandardFonts, rgb} from 'pdf-lib';
import {disciplinaryTable, returnToPlay, sanctionKinds, sanctionState, withCompletedRounds} from './sanctions';
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
 const {cards, resolutions} = sanctionsReport(t, round);
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
 function section(label: string) {
  if (y < margin+50) newPage();
  draw(label,13,bold,green);
  y -= 5;
 }
 paragraph(t.name,18,bold);
 draw(title,12,bold,green);
 if (round === undefined) paragraph('Estado de las resoluciones consultado para la fecha '+referenceRound);
 y -= 16;
 section('Tarjetas registradas');
 if (!cards.length) paragraph('Sin tarjetas registradas.');
 for (const row of cards) {
  if (y < margin+30) newPage();
  paragraph(row.player+' · '+row.team,10,bold);
  paragraph(`Amarillas: ${row.yellow} | Rojas directas: ${row.red} | Expulsiones por doble amarilla: ${row.secondYellow}`);
  y -= 6;
 }
 y -= 14;
 section('Resoluciones disciplinarias');
 if (!resolutions.length) paragraph('Sin resoluciones para este informe.');
 for (const s of resolutions) {
  if (y < margin+65) newPage();
  const team = t.entrants.find(e=>e.id===s.teamId);
  const player = team?.players.find(p=>p.id===s.playerId);
  paragraph((player?.name??'Jugador')+' · '+(team?.name??'Equipo'),10,bold);
  paragraph(`${sanctionKinds[s.kind]} · Desde fecha ${s.startRound}${s.games ? ' · '+s.games+' fecha(s) de suspensión' : ''}`);
  paragraph(sanctionState(s,referenceRound)+' · '+returnToPlay(s));
  if (s.kind==='fine'||s.kind==='redeemable') {
   paragraph(s.paid ? 'Multa pagada después de la fecha '+s.paidAfterRound : 'Multa pendiente de pago');
  }
  if (s.reason) paragraph('Motivo: '+s.reason);
  y -= 8;
 }
 pdf.setTitle(clean(t.name)+' - '+title);
 return pdf.save();
}
