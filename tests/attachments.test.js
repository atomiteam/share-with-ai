import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchAttachment} from '../attachments.js';
test('downloads real text and arbitrary binary bytes without conversion',async()=>{
 for(const data of [new TextEncoder().encode('trace line\n'),new Uint8Array([0,1,255,128,0,65])]){
  const result=await fetchAttachment('https://jira.test/attachment/1',100,async(url,options)=>{assert.equal(options.credentials,'include');return new Response(data,{headers:{'Content-Type':'application/octet-stream'}});});
  assert.deepEqual(result,data);
 }
});
test('rejects HTTP errors and login HTML instead of packing bogus files',async()=>{
 await assert.rejects(fetchAttachment('https://jira.test/file',100,async()=>new Response('Denied',{status:403})),/403/);
 await assert.rejects(fetchAttachment('https://jira.test/file',100,async()=>new Response('<html>Login</html>',{headers:{'content-type':'text/html'}})),/sign-in/);
});
test('enforces streaming and advertised length limits',async()=>{
 await assert.rejects(fetchAttachment('https://jira.test/file',2,async()=>new Response(new Uint8Array([1,2,3]))),/size limit/);
 await assert.rejects(fetchAttachment('https://jira.test/file',2,async()=>new Response('a',{headers:{'content-length':'100'}})),/size limit/);
});
function mp4(){return new Uint8Array([0,0,0,24,102,116,121,112,105,115,111,109,0,0,0,0,105,115,111,109,109,112,52,50,0,0,0,12,109,100,97,116,1,2,3,4]);}
test('rejects 1KB error payload masquerading as MP4 even with binary MIME',async()=>{
 const data=new Uint8Array(1024);data.set(new TextEncoder().encode('{"error":"authentication required"}'));
 await assert.rejects(fetchAttachment('https://jira.test/video',2048,async()=>new Response(data,{headers:{'content-type':'application/octet-stream'}}),{name:'recording.mp4'}),/error\/login document/);
});
test('rejects size mismatch and zero-byte video',async()=>{
 await assert.rejects(fetchAttachment('https://jira.test/a.mp4',2048,async()=>new Response(mp4()),{name:'a.mp4',expectedSize:900}),/expected 900 bytes/);
 await assert.rejects(fetchAttachment('https://jira.test/a.mp4',2048,async()=>new Response(new Uint8Array()),{name:'a.mp4'}),/empty/);
});
test('recovers partial video responses by requesting all bytes',async()=>{
 const data=mp4();let calls=0;
 const bytes=await fetchAttachment('https://jira.test/video',2048,async(url,options)=>{
  calls++;assert.equal(options.cache,'no-store');
  if(calls===1)return new Response(data.subarray(0,16),{status:206,headers:{'content-range':`bytes 0-15/${data.length}`}});
  assert.equal(options.headers.Range,'bytes=0-');
  return new Response(data,{status:206,headers:{'content-range':`bytes 0-${data.length-1}/${data.length}`}});
 },{name:'a.mp4',expectedSize:data.length});
 assert.equal(calls,2);assert.deepEqual(bytes,data);
});
test('rejects persistent partial response rather than saving truncated video',async()=>{
 const data=mp4().subarray(0,16);
 await assert.rejects(fetchAttachment('https://jira.test/video',2048,async()=>new Response(data,{status:206,headers:{'content-range':'bytes 0-15/999'}}),{name:'a.mp4'}),/Partial attachment/);
});
test('complete MP4 bytes are preserved exactly',async()=>{
 const data=mp4();
 const bytes=await fetchAttachment('https://jira.test/video',2048,async()=>new Response(data,{headers:{'content-type':'video/mp4'}}),{name:'a.mp4',expectedSize:data.length});
 assert.deepEqual(bytes,data);
});
