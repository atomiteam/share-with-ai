import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {PROVIDERS,detect,renderTicket,markdown,aiPrompt} from '../core.js';
import {zip,safeName} from '../zip.js';
import {fetchAttachment,validateAttachment} from '../attachments.js';
import {readAttachmentInTab,requireSourceResult} from '../source-fetch.js';
const script=readFileSync(new URL('../export.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
async function scenario(fail=false){
 const ids=new Map(),downloads=[],blobs=[],warnings=[];
 function element(){return {value:'',checked:true,disabled:false,textContent:'',className:'',children:[],dataset:{},append(...x){this.children.push(...x);},replaceChildren(){this.children=[];},getAttribute(){return null;}};}
 const get=id=>{if(!ids.has(id))ids.set(id,element());return ids.get(id);};get('incomplete').checked=false;
 const fixture={schemaVersion:1,provider:'Jira / Jira Service Management',key:'A-1',title:'Fixture',description:'Description',fields:{},comments:[],warnings:[],mode:'api',url:'https://jira.test/browse/A-1',attachments:[{name:'trace.txt',url:'https://jira.test/attachment/1'},{name:'capture.bin',url:'https://jira.test/attachment/2'}]};
 class TestURL extends URL {static createObjectURL(blob){blobs.push(blob);return 'blob:test';}static revokeObjectURL(){}}
 const fetcher=async url=>fail?new Response('Forbidden',{status:403}):new Response(url.endsWith('/1')?'TXT-CONTENT':new Uint8Array([0,255,128,1]),{headers:{'content-type':'application/octet-stream'}});
 const context=vm.createContext({URL:TestURL,URLSearchParams,AbortSignal,structuredClone,Uint8Array,Set,Number,JSON,Date,Error,crypto:globalThis.crypto,atob,btoa,
  PROVIDERS,detect,renderTicket,markdown,aiPrompt,zip,safeName,validateAttachment,readAttachmentInTab,requireSourceResult,fetchAttachment:(url,max,ignored,info)=>fetchAttachment(url,max,fetcher,info),fetch:fetcher,
  location:{search:'?tab=1&auto=1'},navigator:{clipboard:{writeText:async()=>{}}},window:{addEventListener(){}},
  document:{getElementById:get,createElement:element,createTextNode:s=>s,querySelectorAll:s=>s==='#files input:checked'?[{dataset:{index:'0'}},{dataset:{index:'1'}}]:[]},
  chrome:{tabs:{get:async()=>({id:1,url:fixture.url,title:'Fixture'}),create:async()=>{}},scripting:{executeScript:async req=>req.files?[{}]:[{result:structuredClone(fixture)}]},permissions:{contains:async()=>true},downloads:{download:async options=>{downloads.push(options);return 1;}}}
 });
 await vm.runInContext(`(async()=>{${script}\n})()`,context);
 return {ids,downloads,blobs};
}
test('icon auto flow saves ZIP containing TXT and binary without another click',async()=>{
 const r=await scenario();assert.equal(r.downloads.length,1);assert.equal(r.downloads[0].saveAs,false);
 const dir=mkdtempSync(tmpdir()+'/ticketpack-flow-');try{
 writeFileSync(dir+'/out.zip',new Uint8Array(await r.blobs[0].arrayBuffer()));
 execFileSync('python3',['-c',"import zipfile,sys,json; z=zipfile.ZipFile(sys.argv[1]); assert z.read('attachments/001-trace.txt')==b'TXT-CONTENT'; assert z.read('attachments/002-capture.bin')==bytes([0,255,128,1]); assert json.loads(z.read('export-report.json'))['downloaded']==2",dir+'/out.zip']);
 }finally{rmSync(dir,{recursive:true});}
});
test('attachment failures stop automatic export instead of silently omitting files',async()=>{
 const r=await scenario(true);assert.equal(r.downloads.length,0);assert.match(r.ids.get('status').textContent,/No ZIP saved/);
 r.ids.get('incomplete').checked=true;await r.ids.get('download').onclick();assert.equal(r.downloads.length,1);
});
