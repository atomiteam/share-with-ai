import {renderTicket,markdown,aiPrompt} from './core.js';
import {safeName,zip} from './zip.js';
import {MAX_EXPORT_BYTES,fileBudget,isAccessFailure} from './limits.js';
export class AttachmentExportError extends Error {
  constructor(failures){super(`${failures.length} attachment(s) could not be downloaded. No ZIP was saved.`);this.failures=failures;}
}
export async function buildTicketZip(ticket,{fetchFile,onProgress=()=>{}}) {
  const t=structuredClone(ticket),files=[],failures=[];t.exportedAt=new Date().toISOString();let total=0;
  for(let i=0;i<t.attachments.length;i++){
    const a=t.attachments[i];onProgress(`Downloading attachments (${i+1}/${t.attachments.length})…`);
    try {
      const remaining=MAX_EXPORT_BYTES-total;fileBudget(a.size,remaining);
      const bytes=await fetchFile(a,remaining);fileBudget(bytes.length,remaining);total+=bytes.length;
      a.path=`attachments/${String(i+1).padStart(3,'0')}-${safeName(a.name)}`;a.status='downloaded';a.bytes=bytes.length;
      a.sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
      files.push({name:a.path,data:bytes});
    }catch(e){a.status=`FAILED: ${e.message}`;failures.push({name:a.name,message:e.message,origin:new URL(a.url).origin,recoverableAccess:isAccessFailure(e)});}
    delete a.url;
  }
  if(failures.length)throw new AttachmentExportError(failures);
  const report={exportedAt:t.exportedAt,provider:t.provider,mode:t.mode,warnings:t.warnings,downloaded:t.attachments.length,failed:0,excluded:0,attachments:t.attachments};
  files.push({name:'ticket.html',data:renderTicket(t)},{name:'ticket.md',data:markdown(t)},{name:'ticket.json',data:JSON.stringify(t,null,2)},{name:'export-report.json',data:JSON.stringify(report,null,2)},{name:'AI-INSTRUCTIONS.txt',data:aiPrompt(t)});
  onProgress('Preparing ZIP…');return {blob:zip(files),ticket:t,count:t.attachments.length};
}
