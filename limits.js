export const MIB=1024*1024;
export const MAX_FILE_BYTES=250*MIB;
export const MAX_EXPORT_BYTES=500*MIB;
export function formatBytes(bytes){return `${(bytes/MIB).toFixed(1)} MiB`;}
export function fileBudget(size,remaining){
  if(Number.isFinite(size)&&size>MAX_FILE_BYTES){const e=Error(`File size is ${formatBytes(size)}; the per-file limit is ${formatBytes(MAX_FILE_BYTES)}.`);e.code='SIZE_LIMIT';throw e;}
  if(remaining<=0||(Number.isFinite(size)&&size>remaining)){const e=Error(`Only ${formatBytes(Math.max(0,remaining))} remains in the ${formatBytes(MAX_EXPORT_BYTES)} attachment export budget${Number.isFinite(size)?`; this file needs ${formatBytes(size)}`:''}.`);e.code='SIZE_LIMIT';throw e;}
  return Math.min(MAX_FILE_BYTES,remaining);
}
export function isAccessFailure(error){
  if(error.code==='SIZE_LIMIT'||/size limit|exceeds.*limit|budget|per-file limit/i.test(error.message))return false;
  return error.recoverableAccess===true||/permission needed|HTTP (401|403)|failed to fetch|network|login|sign-in|source tab changed/i.test(error.message);
}
