// Validate both extension-context and source-tab responses before ZIP assembly.
export function validateAttachment(bytes, info={}) {
  const name=String(info.name||info.url||'').split(/[?#]/)[0];
  const video=/\.(mp4|m4v|mov|webm|avi|mkv)$/i.test(name)||/^video\//i.test(info.contentType||'');
  if(bytes.length===0 && (video || info.expectedSize!==0))throw Error('Downloaded file is empty');
  if(Number.isFinite(info.expectedSize)&&bytes.length!==info.expectedSize)
    throw Error(`Incomplete or incorrect file: expected ${info.expectedSize} bytes, received ${bytes.length}`);
  if(info.status===206){
    const m=String(info.contentRange||'').match(/^bytes (\d+)-(\d+)\/(\d+)$/i);
    if(!m||Number(m[1])!==0||Number(m[2])+1!==Number(m[3])||bytes.length!==Number(m[3]))
      throw Error(`Partial attachment response (${info.contentRange||'missing Content-Range'}). Full file required.`);
  }
  if(video){
    const prefix=new TextDecoder().decode(bytes.subarray(0,512)).trimStart();
    if(/^(?:<!doctype|<html|<\?xml|<head|<body|\{|\[)/i.test(prefix))throw Error('Video download returned an error/login document instead of video bytes');
    // MP4/M4V use ISO BMFF boxes. This is a format sanity check, not a decoder.
    if(/\.(mp4|m4v)$/i.test(name)||/^video\/mp4(?:;|$)/i.test(info.contentType||'')){
      let offset=0,found=false;const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
      while(offset+8<=Math.min(bytes.length,65536)){
        const size=view.getUint32(offset),type=String.fromCharCode(...bytes.subarray(offset+4,offset+8));
        if(type==='ftyp'&&size>=16&&offset+size<=bytes.length){found=true;break;}
        if(size<8||offset+size>bytes.length)break;offset+=size;
      }
      if(!found)throw Error('Downloaded .mp4 is not a recognized MP4 file (missing ftyp box); it may be an error response');
    }
  }
  return bytes;
}
export async function fetchAttachment(url,maxBytes,fetcher=fetch,info={}) {
  const u=new URL(url);if(!/^https?:$/.test(u.protocol))throw Error('Unsupported attachment URL');
  if(maxBytes<=0)throw Error('Export size limit reached');
  const options={credentials:'include',cache:'no-store',signal:AbortSignal.timeout(120000)};
  let r=await fetcher(u.href,options);
  if(r.status===206){
    const m=(r.headers.get('content-range')||'').match(/^bytes (\d+)-(\d+)\/(\d+)$/i);
    if(!m||Number(m[1])!==0||Number(m[2])+1!==Number(m[3])){
      await r.body?.cancel();
      // Some video endpoints/caches serve a playback range. Request all bytes.
      r=await fetcher(u.href,{...options,headers:{Range:'bytes=0-'}});
    }
  }
  if(!r.ok)throw Error(`HTTP ${r.status}`);
  if(!r.body)throw Error('Empty response');
  const length=Number(r.headers.get('content-length'));
  if(length>maxBytes){await r.body.cancel();throw Error('File exceeds size limit');}
  const reader=r.body.getReader(),chunks=[];let size=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>maxBytes)throw Error('File exceeds size limit');chunks.push(value);}}catch(e){await reader.cancel();throw e;}
  const type=r.headers.get('content-type')||'';
  if(type.includes('text/html')&&!/\.html?$/i.test(u.pathname)&&!/\.html?$/i.test(info.name||''))throw Error('Received HTML instead of file bytes (possibly a sign-in page)');
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
  return validateAttachment(bytes,{...info,url:u.href,status:r.status,contentRange:r.headers.get('content-range'),contentType:type});
}
