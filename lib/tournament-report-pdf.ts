import {PDFDocument, StandardFonts, rgb} from 'pdf-lib';
import {standings} from './standings';
import type {Tournament} from './types';

export async function createTournamentReportPdf(tournament: Tournament, report: 'posiciones' | 'zonas') {
 const pdf = await PDFDocument.create();
 const font = await pdf.embedFont(StandardFonts.Helvetica);
 const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
 const supported = new Set(font.getCharacterSet());
 const clean = (value: string) => Array.from(value.normalize('NFC'), char =>
  supported.has(char.codePointAt(0)!) ? char : /\s/.test(char) ? ' ' : ''
 ).join('').trim();
 const title = report === 'posiciones' ? 'Tablas de posiciones' : 'Equipos por zona';
 const width = 595.28, height = 841.89, margin = 32;
 const green = rgb(.09,.23,.18), ink = rgb(.08,.17,.15);
 const records = report === 'posiciones' ? standings(tournament) : [];
 const showAverage = tournament.settings.tieBreakers.includes('ppg');
 const columns = ['PJ','PG','PE','PP','GF','GC','DG','PTS', ...(showAverage ? ['PPP'] : [])];
 const statsStart = width - margin - columns.length * 31;
 const nameWidth = report === 'posiciones' ? statsStart - margin - 34 : width - margin * 2 - 34;

 function wrap(value: string, maxWidth: number, size: number, face = font) {
  const lines: string[] = [];
  let line = '';
  for (const char of clean(value)) {
   if (line && face.widthOfTextAtSize(line + char, size) > maxWidth) {
    const space = line.lastIndexOf(' ');
    lines.push(space > 0 ? line.slice(0, space) : line);
    line = (space > 0 ? line.slice(space + 1) : '') + char;
   } else line += char;
  }
  return [...lines, line.trimStart()];
 }

 let page = pdf.addPage([width,height]);
 let y = height - margin;
 function draw(value: string, x: number, baseline: number, size = 10, face = font) {
  page.drawText(value,{x,y:baseline,size,font:face,color:ink});
 }
 function header() {
  for (const line of wrap(tournament.name,width-margin*2,18,bold)) {
   draw(line,margin,y-18,18,bold);
   y -= 23;
  }
  draw(title,margin,y-12,12);
  y -= 33;
 }
 function zoneHeader(label: string) {
  page.drawRectangle({x:margin,y:y-22,width:width-margin*2,height:22,color:green});
  page.drawText(label,{x:margin+8,y:y-15,size:11,font:bold,color:rgb(1,1,1)});
  y -= 22;
  if (report === 'posiciones') {
   draw('#',margin+6,y-13,9,bold);
   draw('Equipo',margin+28,y-13,9,bold);
   columns.forEach((column,i)=>draw(column,statsStart+i*31,y-13,9,bold));
   y -= 19;
  }
 }
 header();
 for (let group=0;group<tournament.settings.groups;group++) {
  const label = 'Zona ' + String.fromCharCode(65+group);
  const teams = report === 'posiciones'
   ? records.filter(row=>row.group===group).map(row=>({
    name:row.name,
    stats:[row.played,row.won,row.drawn,row.lost,row.gf,row.ga,row.difference,row.points,...(showAverage?[row.ppg.toFixed(2)]:[])].map(String)
   }))
   : tournament.entrants.filter(team=>team.group===group).map(team=>({name:team.name,stats:[]}));
  function nextPage() {
   page = pdf.addPage([width,height]);
   y = height-margin;
   header();
  }
  if (y < margin+75) nextPage();
  zoneHeader(label);
  if (!teams.length) {
   draw('Sin equipos',margin+8,y-14);
   y -= 22;
  }
  teams.forEach((team,index)=>{
   const lines = wrap(team.name,nameWidth,10);
   const rowHeight = lines.length*13+7;
   if (y-rowHeight < margin) {
    nextPage();
    zoneHeader(label+' (continuación)');
   }
   draw(String(index+1),margin+6,y-13);
   lines.forEach((line,i)=>draw(line,margin+28,y-13-i*13));
   team.stats.forEach((value,i)=>draw(value,statsStart+i*31,y-13,9,i===7?bold:font));
   y -= rowHeight;
   page.drawLine({start:{x:margin,y},end:{x:width-margin,y},thickness:.4,color:rgb(.83,.87,.84)});
  });
  y -= 17;
 }
 pdf.setTitle(clean(tournament.name)+' - '+title);
 return pdf.save();
}
