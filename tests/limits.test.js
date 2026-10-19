import test from 'node:test';
import assert from 'node:assert/strict';
import {fileBudget,MAX_FILE_BYTES,MAX_EXPORT_BYTES,MIB,isAccessFailure} from '../limits.js';
import {buildTicketZip} from '../workflow.js';
test('budget allows files beyond the previous 25MiB limit and enforces new boundaries',()=>{
 assert.equal(fileBudget(30*MIB,MAX_EXPORT_BYTES),MAX_FILE_BYTES);
 assert.equal(fileBudget(250*MIB,MAX_EXPORT_BYTES),MAX_FILE_BYTES);
 assert.throws(()=>fileBudget(251*MIB,MAX_EXPORT_BYTES),/251.0 MiB.*250.0 MiB/);
 assert.throws(()=>fileBudget(30*MIB,20*MIB),/20.0 MiB.*500.0 MiB.*30.0 MiB/);
});
test('size failures cannot be presented as permission failures',()=>{
 assert.equal(isAccessFailure(Error('File exceeds size limit')),false);
 assert.equal(isAccessFailure({message:'Only 20 MiB remains in budget',recoverableAccess:true}),false);
 assert.equal(isAccessFailure(Error('HTTP 403')),true);
});
test('workflow actually packs a 26MiB file and uses the 500MiB total budget',async()=>{
 const bytes=new Uint8Array(26*MIB);bytes[0]=65;bytes[bytes.length-1]=90;
 const ticket={title:'Log',key:'A-1',url:'https://jira.test/browse/A-1',provider:'Jira',mode:'api',description:'',fields:{},comments:[],warnings:[],attachments:[{name:'large.log',size:bytes.length,url:'https://jira.test/a'}]};
 const result=await buildTicketZip(ticket,{fetchFile:async(a,remaining)=>{assert.equal(remaining,500*MIB);return bytes;}});
 assert.equal(result.count,1);assert.equal(result.ticket.attachments[0].bytes,26*MIB);assert.ok(result.blob.size>26*MIB);
});
