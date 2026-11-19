import {PDFDocument,StandardFonts,rgb,type PDFFont} from 'pdf-lib';
import type {Tournament} from './types';
import {roundLabel} from './playoffs';
const zone=(group:number|null)=>group===null?'Interzonal':`Zona ${String.fromCharCode(65+group)}`;
const dateFormat=new Intl.DateTimeFormat('es-AR',{timeZone:'America/Argentina/Cordoba',day:'2-digit',month:'2-digit',year:'numeric'});
const timeFormat=new Intl.DateTimeFormat('es-AR',{timeZone:'America/Argentina/Cordoba',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export async function createFixturePdf(t:Tournament):Promise<Uint8Array>{
 if(!t.matches.length)throw Error('Todavía no hay un fixture para descargar.');
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
 const supported=new Set(font.getCharacterSet());
 const clean=(value:string)=>Array.from(value.normalize('NFC')).map(c=>supported.has(c.codePointAt(0)!)?c:/\s/.test(c)?' ':Array.from(c.normalize('NFD')).filter(x=>supported.has(x.codePointAt(0)!)).join('')).join('').replace(/\s+/g,' ').trim();
 function wrap(value:string,width:number,size:number,f:PDFFont=font):string[]{
  const result:string[]=[];let line='';
  for(const char of clean(value)){if(line&&f.widthOfTextAtSize(line+char,size)>width){const space=line.lastIndexOf(' ');if(space>0){result.push(line.slice(0,space));line=line.slice(space+1)+char;}else{result.push(line);line=char;}}else line+=char;}
  if(line)result.push(line);return result.length?result:[''];
 }
 const teams=new Map(t.entrants.map(e=>[e.id,e.name]));
 const rounds=[...new Set(t.matches.map(m=>m.round))].sort((a,b)=>a-b);
 const margin=24,gap=12;
 function plan(width:number,height:number,columns:number,size:number){
  const colWidth=(width-2*margin-gap*(columns-1))/columns;
  const timeWidth=font.widthOfTextAtSize('00:00',size)+8,zoneWidth=font.widthOfTextAtSize('Interzonal',size)+8,courtWidth=Math.max(48,colWidth*.15);
  const widths=[timeWidth,zoneWidth,colWidth-timeWidth-zoneWidth-courtWidth,courtWidth];
  const title=wrap(t.name,width-2*margin,17,bold),subtitle=wrap(`Fixture completo | ${t.season} | ${t.category} | ${t.matches.length} partidos`,width-2*margin,8);
  const top=height-margin-title.length*20-subtitle.length*11-16,available=top-38;
  const blocks=rounds.map(round=>{
   const matches=t.matches.filter(m=>m.round===round).sort((a,b)=>(a.startsAt||'').localeCompare(b.startsAt||'')||a.slot-b.slot||a.pitch.localeCompare(b.pitch));
   const calendar=t.settings.roundCalendar?.find(d=>d.round===round)?.date;
   const instant=calendar?new Date(calendar+'T12:00:00-03:00'):new Date(matches.find(m=>m.startsAt)?.startsAt||'');
   const heading=wrap(`${roundLabel(t,round)} | ${Number.isNaN(+instant)?'Día a confirmar':dateFormat.format(instant)}`,colWidth-10,size+1,bold);
   const rows=matches.map(m=>{
    const d=new Date(m.startsAt),score=m.status==='finished'?`${m.homeScore??'-'}-${m.awayScore??'-'}`:'vs';
    const penalties=m.status==='finished'&&m.homePenalties!=null&&m.awayPenalties!=null?` (pen. ${m.homePenalties}-${m.awayPenalties})`:'';
    const values=[Number.isNaN(+d)?'--:--':timeFormat.format(d),m.kind==='playoff'?'Cruce':zone(m.group),`${teams.get(m.home)||'Equipo'} ${score} ${teams.get(m.away)||'Equipo'}${penalties}`,m.pitch||'A confirmar'];
    const cells=values.map((v,i)=>wrap(v,widths[i]-6,size));return {cells,height:Math.max(...cells.map(c=>c.length))*size*1.25+6};
   });
   const byes=matches.some(m=>m.kind==='playoff')?[]:t.entrants.filter(e=>!matches.some(m=>m.home===e.id||m.away===e.id));
   const byeLines=byes.length?wrap(`Libre${byes.length>1?'s':''}: ${byes.map(e=>e.name).join(', ')}`,colWidth-8,size-1):[];
   const headerHeight=heading.length*(size+1)*1.25+8;
   return {heading,headerHeight,rows,byeLines,height:headerHeight+size*1.25+6+rows.reduce((n,r)=>n+r.height,0)+byeLines.length*size*1.25+10};
  });
  const groups:typeof blocks[]=[[]];let used=0;
  for(const block of blocks){if(used&&used+block.height>available){groups.push([]);used=0;}groups.at(-1)!.push(block);used+=block.height;}
  return {width,height,colWidth,widths,top,title,subtitle,groups,size,fits:groups.length<=columns&&blocks.every(b=>b.height<=available)};
 }
 // Prefer readable text; use more columns or landscape before reducing its size.
 let chosen:ReturnType<typeof plan>|undefined;
 for(let columns=1;columns<=3&&!chosen;columns++){for(let size=10.5;size>=7.5&&!chosen;size-=.25){for(const [width,height] of [[595.28,841.89],[841.89,595.28]]){const candidate=plan(width,height,columns,size);if(candidate.fits){chosen=candidate;break;}}}}
 if(!chosen){for(let size=7.25;size>=4.5;size-=.25){const candidate=plan(841.89,595.28,3,size);if(candidate.fits){chosen=candidate;break;}}}
 if(!chosen)throw Error('El fixture es demasiado extenso para una sola hoja legible.');
 const p=chosen,page=doc.addPage([p.width,p.height]),ink=rgb(.08,.17,.15),green=rgb(.09,.23,.18),light=rgb(.94,.96,.94),line=rgb(.83,.87,.84);
 const text=(value:string,x:number,y:number,size:number,f:PDFFont=font,color=ink)=>page.drawText(value,{x,y,size,font:f,color});
 let headerY=p.height-margin-17;for(const row of p.title){text(row,margin,headerY,17,bold);headerY-=20;}headerY-=1;for(const row of p.subtitle){text(row,margin,headerY,8);headerY-=11;}
 p.groups.forEach((blocks,col)=>{const x=margin+col*(p.colWidth+gap);let y=p.top;
  for(const block of blocks){
   page.drawRectangle({x,y:y-block.headerHeight,width:p.colWidth,height:block.headerHeight,color:green});let baseline=y-p.size-5;
   for(const row of block.heading){text(row,x+5,baseline,p.size+1,bold,rgb(1,1,1));baseline-=(p.size+1)*1.25;}y-=block.headerHeight;
   const tableHeader=p.size*1.25+6;page.drawRectangle({x,y:y-tableHeader,width:p.colWidth,height:tableHeader,color:light});let cellX=x;
   ['Hora','Zona','Partido','Cancha'].forEach((v,i)=>{text(v,cellX+3,y-p.size-2,p.size-1,bold);cellX+=p.widths[i];});y-=tableHeader;
   for(const row of block.rows){let cellX=x;row.cells.forEach((lines,i)=>{lines.forEach((value,j)=>text(value,cellX+3,y-p.size-2-j*p.size*1.25,p.size));cellX+=p.widths[i];});y-=row.height;page.drawLine({start:{x,y},end:{x:x+p.colWidth,y},thickness:.35,color:line});}
   for(const row of block.byeLines){text(row,x+4,y-p.size,p.size-1);y-=p.size*1.25;}y-=10;
  }
 });
 text('Gestor de Torneo | Horarios de Argentina (UTC-3)',margin,18,7);
 doc.setTitle(`${clean(t.name)} - Fixture`);doc.setCreator('Gestor de Torneo');return doc.save();
}
