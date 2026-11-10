import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateRulesPdf,rulesPathPattern,RULES_MAX_BYTES} from '../lib/rules-pdf';
test('PDF uploads validate content, format and maximum size',async()=>{
 assert.equal(await validateRulesPdf(new File(['%PDF-1.4\n'],'Reglamento.pdf',{type:'application/pdf'})),'Reglamento.pdf');
 await assert.rejects(validateRulesPdf(new File(['not pdf'],'archivo.pdf',{type:'application/pdf'})),/válido/);
 await assert.rejects(validateRulesPdf(new File(['%PDF-1.4'],'archivo.html',{type:'text/html'})),/PDF/);
 await assert.rejects(validateRulesPdf(new File([new Uint8Array(RULES_MAX_BYTES+1)],'grande.pdf',{type:'application/pdf'})),/4 MB/);
 assert.equal(await validateRulesPdf(new File(['%PDF-1.4'],'bad\nname.pdf',{type:'application/pdf'})),'bad_name.pdf');
});
test('PDF paths only accept tournament-scoped immutable files',()=>{
 assert.ok(rulesPathPattern.test('10000000-0000-4000-a000-000000000001/20000000-0000-4000-a000-000000000001.pdf'));
 for(const path of ['https://evil.test/file.pdf','../private.pdf','id/file.pdf','10000000-0000-4000-a000-000000000001/../../file.pdf'])assert.equal(rulesPathPattern.test(path),false);
});
test('PDF API rejects anonymous uploads and unsafe download paths before contacting storage',async()=>{
 const {POST,GET}=await import('../app/api/tournament-rules/route');const {NextRequest}=await import('next/server');
 assert.equal((await POST(new NextRequest('http://localhost/api/tournament-rules',{method:'POST'}))).status,401);
 assert.equal((await GET(new NextRequest('http://localhost/api/tournament-rules?path=..%2Fprivate.pdf'))).status,400);
});
