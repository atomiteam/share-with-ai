// Self-contained for chrome.scripting.executeScript. Always serialize errors.
export async function readAttachmentInTab(url,max) {
  try {
    if(new URL(url).origin!==location.origin)throw Error('Source tab changed. Recapture the ticket.');
    const r=await fetch(url,{credentials:'include',cache:'no-store',signal:AbortSignal.timeout(120000)});
    if(!r.ok)throw Error(`HTTP ${r.status}`);
    if(!r.body)throw Error('Empty response');
    const reader=r.body.getReader(),chunks=[];let n=0;
    try{while(true){const {value,done}=await reader.read();if(done)break;n+=value.length;if(n>max)throw Error('File exceeds size limit');chunks.push(value);}}
    catch(e){await reader.cancel();throw e;}
    const bytes=new Uint8Array(n);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
    let str='';for(let i=0;i<bytes.length;i+=32768)str+=String.fromCharCode(...bytes.subarray(i,i+32768));
    return {ok:true,base64:btoa(str),status:r.status,contentRange:r.headers.get('content-range'),contentType:r.headers.get('content-type')||''};
  }catch(e){return {ok:false,error:e?.message||String(e)};}
}
export function requireSourceResult(result) {
  if(!result||typeof result!=='object')throw Error('Browser returned no attachment result. Reopen the ticket and retry.');
  if(result.ok!==true)throw Error(result.error||'Source-tab download failed');
  if(typeof result.base64!=='string')throw Error('Browser returned invalid attachment data');
  return result;
}
