export const RULES_BUCKET='tournament-rules';
export const RULES_MAX_BYTES=4*1024*1024;
export const rulesPathPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/;
export async function validateRulesPdf(file:File){
 if(file.size<5||file.size>RULES_MAX_BYTES)throw Error('El PDF debe pesar hasta 4 MB.');
 if(file.type!=='application/pdf'||!file.name.toLowerCase().endsWith('.pdf'))throw Error('Seleccioná un archivo PDF.');
 const header=new Uint8Array(await file.slice(0,5).arrayBuffer());
 if(String.fromCharCode(...header)!=='%PDF-')throw Error('El archivo no contiene un PDF válido.');
 return file.name.replace(/[\\/\r\n\x00-\x1f\x7f]/g,'_').slice(0,180);
}
