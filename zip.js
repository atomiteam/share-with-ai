// ZIP32, STORE method. No remote code, dependencies, or compression workers.
const enc = new TextEncoder();
const table = Array.from({length:256}, (_, n) => {
  for(let i=0;i<8;i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
export function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = table[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
export function safeName(value) {
  let s = String(value || 'file').normalize('NFKC').replace(/[\x00-\x1f\x7f\\/:*?"<>|#%]/g, '_').replace(/^\.+|[. ]+$/g, '').slice(0,160);
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(s)) s='_'+s;
  return s || 'file';
}
export function zip(files) {
  if (files.length > 65535) throw Error('Too many ZIP entries');
  let offset=0; const chunks=[], central=[];
  const seen = new Set();
  for (const f of files) {
    if (!f.name || f.name.startsWith('/') || f.name.split('/').some(x => !x || x === '.' || x === '..') || /[\\\x00]/.test(f.name)) throw Error('Unsafe ZIP path');
    if (seen.has(f.name)) throw Error('Duplicate ZIP path'); seen.add(f.name);
    const name=enc.encode(f.name), data=typeof f.data==='string'?enc.encode(f.data):f.data;
    if (!(data instanceof Uint8Array) || name.length>65535 || data.length>0xffffffff) throw Error('ZIP entry too large or invalid');
    const crc=crc32(data), h=new Uint8Array(30), v=new DataView(h.buffer);
    v.setUint32(0,0x04034b50,true); v.setUint16(4,20,true); v.setUint16(6,0x800,true);
    v.setUint16(12,33,true); v.setUint32(14,crc,true); v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);
    chunks.push(h,name,data);
    const c=new Uint8Array(46), d=new DataView(c.buffer);
    d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint16(14,33,true);
    d.setUint32(16,crc,true);d.setUint32(20,data.length,true);d.setUint32(24,data.length,true);d.setUint16(28,name.length,true);d.setUint32(42,offset,true);
    central.push(c,name);offset+=h.length+name.length+data.length;
    if(offset>0xffffffff) throw Error('ZIP32 size exceeded');
  }
  const size=central.reduce((n,x)=>n+x.length,0), end=new Uint8Array(22), e=new DataView(end.buffer);
  e.setUint32(0,0x06054b50,true); e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,size,true);e.setUint32(16,offset,true);
  return new Blob([...chunks,...central,end],{type:'application/zip'});
}
