import test from 'node:test';
import assert from 'node:assert/strict';
import {zip,crc32,safeName} from '../zip.js';
import {detect,renderTicket} from '../core.js';
import {writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
test('ZIP round trips binary, empty and Unicode files in independent Python reader',async()=>{
 const p=mkdtempSync(tmpdir()+'/ticketpack-');
 try{
 const blob=zip([{name:'ticket.md',data:'Hello world'},{name:'attachments/çalışma.bin',data:new Uint8Array([0,255,1,128])},{name:'empty',data:''}]);
 writeFileSync(p+'/out.zip',new Uint8Array(await blob.arrayBuffer()));
 execFileSync('python3',['-c',"import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; assert z.read('ticket.md') == b'Hello world'; assert z.read('attachments/çalışma.bin') == bytes([0,255,1,128]); assert z.read('empty') == b''",p+'/out.zip']);
 }finally{rmSync(p,{recursive:true});}
});
test('ZIP rejects traversal and duplicate entries',()=>{
 for(const name of ['../bad','/bad','a/../../bad','a\\b'])assert.throws(()=>zip([{name,data:''}]));
 assert.throws(()=>zip([{name:'same',data:''},{name:'same',data:''}]));
 assert.equal(crc32(new TextEncoder().encode('123456789')),0xcbf43926);
 assert.ok(!safeName('../../bad:thing').includes('/'));
});
test('provider recognition handles cloud and self-hosted paths',()=>{
 assert.equal(detect('https://company.example/jira/browse/ABC-42'),'Jira / Jira Service Management');
 assert.equal(detect('https://dev.azure.com/org/project/_workitems/edit/42'),'Azure DevOps');
 assert.equal(detect('https://git.example/team/sub/project/-/issues/1'),'GitLab');
 assert.equal(detect('https://github.com/org/project/issues/1'),'GitHub');
 assert.equal(detect('https://example.com/show_bug.cgi?id=4'),'Bugzilla');
 assert.equal(detect('https://example.com/'),'Other');
});
test('offline HTML escapes hostile ticket content and blocks remote resources',()=>{
 const t={title:'<script>alert(1)</script>',provider:'Jira',key:'A-1',url:'javascript:alert(1)',mode:'api',description:'<img src=x onerror=alert(1)>',fields:{bad:'<iframe>'},comments:[],attachments:[{name:'<bad>',path:'attachments/1.txt',status:'downloaded'}],warnings:[],exportedAt:'now'};
 const html=renderTicket(t);assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img src=x'));assert.ok(html.includes('href="#"'));assert.ok(html.includes("default-src 'none'"));assert.ok(html.includes('&lt;iframe&gt;'));
});
