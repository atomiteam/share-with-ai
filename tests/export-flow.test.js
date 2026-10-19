import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {detect,aiPrompt} from '../core.js';
import {safeName} from '../zip.js';
import {fetchAttachment,validateAttachment} from '../attachments.js';
import {readAttachmentInTab,requireSourceResult} from '../source-fetch.js';
import {buildTicketZip} from '../workflow.js';
import {saveZipDownload} from '../downloads.js';
import {fileBudget,isAccessFailure,MIB} from '../limits.js';
const script=readFileSync(new URL('../export.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
async function scenario({fail=false,clipboardFail=false,url='https://jira.test/browse/A-1',downloadState='complete',openFail=false,size}={}){
 const ids=new Map(),downloads=[],blobs=[],tabs=[],listeners=new Set(),aiButtons=['chatgpt','claude','gemini','copilot'].map(ai=>({dataset:{ai}}));
 function element(){return {value:'',hidden:true,disabled:false,textContent:'',children:[],dataset:{},attributes:{},append(...x){this.children.push(...x);},replaceChildren(){this.children=[];},setAttribute(k,v){this.attributes[k]=v;},focus(){}};}
 const get=id=>{if(!ids.has(id))ids.set(id,element());return ids.get(id);};
 const fixture={schemaVersion:1,provider:'Jira / Jira Service Management',key:'A-1',title:'PRIVATE TITLE',description:'PRIVATE DESCRIPTION',fields:{private:'FIELD'},comments:[],warnings:[],mode:'api',url,attachments:[{name:'trace.txt',url:'https://jira.test/attachment/1',size},{name:'capture.bin',url:'https://jira.test/attachment/2'}]};
 class TestURL extends URL {static createObjectURL(blob){blobs.push(blob);return 'blob:test';}static revokeObjectURL(){}}
 const fetcher=async u=>fail?new Response('Forbidden',{status:403}):new Response(u.endsWith('/1')?'TXT-CONTENT':new Uint8Array([0,255,128,1]),{headers:{'content-type':'application/octet-stream'}});
 const context=vm.createContext({URL:TestURL,URLSearchParams,AbortSignal,structuredClone,Uint8Array,Set,Number,JSON,Date,Error,crypto:globalThis.crypto,atob,btoa,
  fileBudget,isAccessFailure,MIB,detect,aiPrompt,safeName,validateAttachment,readAttachmentInTab,requireSourceResult,buildTicketZip,saveZipDownload:(o)=>saveZipDownload(o,chrome.downloads),fetchAttachment:(u,max,ignored,info)=>fetchAttachment(u,max,fetcher,info),fetch:fetcher,
  location:{search:'?tab=1&auto=1'},navigator:{clipboard:{writeText:async()=>{if(clipboardFail)throw Error('denied');}}},window:{addEventListener(){}},
  document:{getElementById:get,createElement:element,createTextNode:s=>s,querySelectorAll:()=>aiButtons,addEventListener(){}},
  chrome:null
 });
 const chrome={tabs:{get:async()=>({id:1,url,title:'Fixture'}),create:async options=>{if(openFail)throw Error('Could not open app');tabs.push(options);}},scripting:{executeScript:async req=>req.files?[{}]:[{result:req.func===readAttachmentInTab?{ok:false,error:'Source request refused'}:structuredClone(fixture)}]},permissions:{contains:async()=>true,request:async()=>true},downloads:{onChanged:{addListener:f=>listeners.add(f),removeListener:f=>listeners.delete(f)},search:async()=>[{id:1,state:downloadState,error:downloadState==='interrupted'?'USER_CANCELED':undefined}],download:async options=>{downloads.push(options);return 1;}}};
 context.chrome=chrome;await vm.runInContext(`(async()=>{${script}\n})()`,context);
 return {ids,downloads,blobs,tabs,aiButtons};
}
test('automatic export preserves TXT/binary and never renders private ticket details',async()=>{
 const r=await scenario();assert.equal(r.downloads.length,1);assert.equal(r.downloads[0].saveAs,false);assert.equal(r.ids.get('status-title').textContent,'Download complete');
 assert.ok(!r.ids.has('title'));assert.ok(![...r.ids.values()].some(e=>e.textContent.includes('PRIVATE')));
 const dir=mkdtempSync(tmpdir()+'/share-ai-flow-');try{
 writeFileSync(dir+'/out.zip',new Uint8Array(await r.blobs[0].arrayBuffer()));
 execFileSync('python3',['-c',"import zipfile,sys,json; z=zipfile.ZipFile(sys.argv[1]); assert z.read('attachments/001-trace.txt')==b'TXT-CONTENT'; assert z.read('attachments/002-capture.bin')==bytes([0,255,128,1]); assert json.loads(z.read('ticket.json'))['title']=='PRIVATE TITLE'; assert json.loads(z.read('export-report.json'))['downloaded']==2",dir+'/out.zip']);
 }finally{rmSync(dir,{recursive:true});}
});
test('attachment failures get a visible error section and never save incomplete ZIP',async()=>{
 const r=await scenario({fail:true});assert.equal(r.downloads.length,0);assert.equal(r.ids.get('errors').hidden,false);assert.match(r.ids.get('error-summary').textContent,/No ZIP was saved/);assert.equal(r.ids.get('error-list').children.length,2);assert.equal(r.ids.get('permissions').children.length,1);
});
test('AI handoff reuses completed ZIP and confirms manual attachment instructions',async()=>{
 const r=await scenario();await r.aiButtons[0].onclick();assert.equal(r.downloads.length,1);assert.equal(r.tabs[0].url,'https://chatgpt.com/');assert.equal(r.ids.get('status-title').textContent,'Ready to share');assert.match(r.ids.get('status').textContent,/Prompt copied/);assert.match(r.ids.get('status').textContent,/No file was uploaded automatically/);
});
test('clipboard failure remains visible without claiming prompt copied',async()=>{
 const r=await scenario({clipboardFail:true});await r.aiButtons[1].onclick();assert.equal(r.ids.get('warnings').hidden,false);assert.match(r.ids.get('warning-list').children[0].textContent,/could not be copied/);assert.doesNotMatch(r.ids.get('status').textContent,/Prompt copied/);
});
test('interrupted save never displays success or opens AI',async()=>{
 const r=await scenario({downloadState:'interrupted'});assert.equal(r.ids.get('status-title').textContent,'Action failed');assert.match(r.ids.get('error-summary').textContent,/USER_CANCELED/);assert.equal(r.tabs.length,0);
});
test('Jira dashboard is rejected rather than exported as a ticket',async()=>{
 const r=await scenario({url:'https://tenant.atlassian.net/jira/for-you?tab=assigned'});assert.equal(r.downloads.length,0);assert.match(r.ids.get('error-summary').textContent,/individual Jira ticket/);
});
test('AI app opening failure preserves saved ZIP and gives retry feedback',async()=>{
 const r=await scenario({openFail:true});await r.aiButtons[0].onclick();assert.equal(r.ids.get('errors').hidden,false);assert.match(r.ids.get('status').textContent,/ZIP is saved/);assert.match(r.ids.get('error-summary').textContent,/Could not open app/);
});

test('size-limit error shows the actual size without a permission button',async()=>{
 const r=await scenario({size:251*MIB});assert.equal(r.downloads.length,0);assert.equal(r.ids.get('permissions').children.length,0);assert.match(r.ids.get('error-list').children[0].textContent,/251.0 MiB/);assert.match(r.ids.get('error-list').children[0].textContent,/250.0 MiB/);
});
