import test from 'node:test';
import assert from 'node:assert/strict';
import {saveZipDownload} from '../downloads.js';
function api(state='in_progress'){
 const listeners=new Set();return {listeners,onChanged:{addListener:f=>listeners.add(f),removeListener:f=>listeners.delete(f)},download:async()=>42,search:async()=>[{id:42,state}],emit:d=>listeners.forEach(f=>f(d))};
}
test('save feedback waits for Chrome completion rather than request acceptance',async()=>{
 const a=api();let complete=false;const pending=saveZipDownload({url:'blob:test'},a).then(()=>{complete=true;});
 await new Promise(r=>setImmediate(r));assert.equal(complete,false);a.emit({id:9,state:{current:'complete'}});assert.equal(complete,false);
 a.emit({id:42,state:{current:'complete'}});await pending;assert.equal(complete,true);assert.equal(a.listeners.size,0);
});
test('completion before initial request resolves is not missed',async()=>{
 const a=api();a.download=async()=>{a.emit({id:42,state:{current:'complete'}});return 42;};
 assert.equal(await saveZipDownload({},a),42);assert.equal(a.listeners.size,0);
});
test('interrupted and cancelled downloads report failure',async()=>{
 const a=api();const pending=saveZipDownload({},a);await new Promise(r=>setImmediate(r));a.emit({id:42,state:{current:'interrupted'},error:{current:'USER_CANCELED'}});
 await assert.rejects(pending,/USER_CANCELED/);assert.equal(a.listeners.size,0);
});
test('already-completed download is found through Chrome search',async()=>{const a=api('complete');assert.equal(await saveZipDownload({},a),42);});
test('timeout and rejected download release listeners',async()=>{
 const a=api();await assert.rejects(saveZipDownload({},a,5),/not confirmed completion/);assert.equal(a.listeners.size,0);
 const b=api();b.download=async()=>{throw Error('blocked');};await assert.rejects(saveZipDownload({},b),/blocked/);assert.equal(b.listeners.size,0);
});
