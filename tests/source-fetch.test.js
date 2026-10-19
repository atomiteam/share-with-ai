import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readAttachmentInTab,requireSourceResult} from '../source-fetch.js';
async function run(fetcher){
 const ctx=vm.createContext({URL,location:{origin:'https://jira.test'},fetch:fetcher,AbortSignal,Uint8Array,btoa});
 return vm.runInContext(`(${readAttachmentInTab.toString()})('https://jira.test/attachment/1',1024)`,ctx);
}
test('source-tab network rejection serializes original error',async()=>{
 const result=await run(async()=>{throw Error('Failed to fetch: blocked redirect');});
 assert.equal(result.ok,false);assert.throws(()=>requireSourceResult(result),/blocked redirect/);
});
test('source-tab null result is handled without base64 TypeError',()=>{
 assert.throws(()=>requireSourceResult(null),/no attachment result/);
 assert.throws(()=>requireSourceResult({ok:true}),/invalid attachment data/);
});
test('source-tab success transfers exact binary in a structured result',async()=>{
 const result=await run(async()=>new Response(new Uint8Array([0,255,128,1]),{headers:{'content-type':'application/octet-stream'}}));
 assert.equal(result.ok,true);assert.equal(result.status,200);assert.deepEqual([...Uint8Array.from(atob(requireSourceResult(result).base64),c=>c.charCodeAt(0))],[0,255,128,1]);
});
