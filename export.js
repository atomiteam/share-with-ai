import {PROVIDERS,detect,renderTicket,markdown,aiPrompt} from './core.js';
import {zip,safeName} from './zip.js';
import {fetchAttachment,validateAttachment} from './attachments.js';
import {readAttachmentInTab,requireSourceResult} from './source-fetch.js';
const $=id=>document.getElementById(id), tabId=Number(new URLSearchParams(location.search).get('tab'));
let ticket=null, sourceTab=null, busy=false;const urls=new Set();
const status=s=>{$('status').textContent=s;};
const warn=s=>{const p=document.createElement('p');p.className='warning';p.textContent=s;$('warnings').append(p);};
for(const p of PROVIDERS){const o=document.createElement('option');o.textContent=p;$('provider').append(o);}
async function inject(func,args=[]) {const r=await chrome.scripting.executeScript({target:{tabId},func,args});if(!r[0]||r[0].error)throw Error('Source tab unavailable');return r[0].result;}
function setBusy(v){busy=v;for(const id of ['capture','download','handoff','provider','api','toggleFiles','title','description','fields','comments','commentEditor','task','ai','incomplete'])$(id).disabled=v||(['download','handoff'].includes(id)&&!ticket);document.querySelectorAll('#files input,#files button').forEach(x=>x.disabled=v);}
async function capture(){
  if(busy)return;setBusy(true);ticket=null;$('warnings').replaceChildren();$('review').hidden=true;
  try{
    const current=await chrome.tabs.get(tabId);if(!/^https?:\/\//.test(current.url||''))throw Error('Open a ticket on an HTTP or HTTPS page, then click the extension icon.');
    sourceTab=current;let p=$('provider').value;if(p==='Auto detect')p=detect(current.url,current.title);
    $('source').textContent=current.url;status('Collecting ticket details…');
    await chrome.scripting.executeScript({target:{tabId},files:['collector.js']});
    ticket=await inject(async(p,api)=>globalThis.ticketpackCollect(p,api),[p,$('api').checked]);
    $('mode').textContent=ticket.mode==='api'?'API capture':'Partial · visible page';
    $('title').value=ticket.title;$('description').value=ticket.description;$('fieldPreview').textContent=JSON.stringify(ticket.fields,null,2);
    $('fieldCount').textContent=`(${Object.keys(ticket.fields).length})`;$('commentCount').textContent=`(${ticket.comments.length})`;
    $('commentEditor').value=JSON.stringify(ticket.comments,null,2);ticket.warnings.forEach(warn);renderFiles();$('review').hidden=false;
    status(`Captured ${ticket.comments.length} comments and ${ticket.attachments.length} attachment links. Review the content before exporting.`);
  }catch(e){ticket=null;status(e.message);warn('If the ticket tab navigated or was closed, reopen it and click the extension icon again.');}
  finally{setBusy(false);}
}
function renderFiles(){
  $('files').replaceChildren();$('toggleFiles').textContent='Select none';
  if(!ticket.attachments.length){$('files').textContent='No downloadable attachment links found.';return;}
  ticket.attachments.forEach((a,i)=>{
    const div=document.createElement('div');div.className='file';const label=document.createElement('label');label.className='check';
    const check=document.createElement('input');check.type='checkbox';check.checked=true;check.dataset.index=i;
    label.append(check,document.createTextNode(a.name));div.append(label);
    const p=document.createElement('p'),u=new URL(a.url);p.textContent=`${u.hostname}${a.size?' · '+(a.size/1048576).toFixed(1)+' MiB':''}`;div.append(p);
    {const b=document.createElement('button');b.textContent=`Allow download from ${u.hostname}`;
      b.onclick=async()=>{try{const yes=await chrome.permissions.request({origins:[`${u.origin}/*`]});b.textContent=yes?'Host allowed':'Permission declined';}catch(e){status(e.message);}};div.append(b);}
    $('files').append(div);
  });
}
$('toggleFiles').onclick=()=>{const inputs=[...document.querySelectorAll('#files input')],next=!inputs.some(x=>x.checked);inputs.forEach(x=>x.checked=next);$('toggleFiles').textContent=next?'Select none':'Select all';};
async function fetchFile(a,remaining){
  const u=new URL(a.url),origin=new URL(ticket.url).origin,limit=Math.min(25*1048576,remaining);
  if(a.size>limit)throw Error('File exceeds remaining export size limit');
  if(u.origin!==origin&&!await chrome.permissions.contains({origins:[`${u.origin}/*`]}))throw Error(`Permission needed: ${u.hostname}. Use its Allow download button.`);
  let extensionError;
  try{return await fetchAttachment(a.url,limit,fetch,{name:a.name,expectedSize:a.size});}catch(e){extensionError=e;}
  if(u.origin===origin){
    try {
      const result=requireSourceResult(await inject(readAttachmentInTab,[a.url,limit]));
      if(result.contentType.includes('text/html')&&!/\.html?$/i.test(a.name))throw Error('Source tab received an HTML login/error page instead of the attachment');
      return validateAttachment(Uint8Array.from(atob(result.base64),c=>c.charCodeAt(0)),{name:a.name,expectedSize:a.size,status:result.status,contentRange:result.contentRange,contentType:result.contentType});
    } catch(e) {throw Error(`Extension download: ${extensionError.message}. Source-tab download: ${e.message}`);}

  }
  throw extensionError;
}
function editedTicket(){
  const t=structuredClone(ticket);t.title=$('title').value;t.description=$('description').value;t.fields=$('fields').checked?t.fields:{};
  if($('comments').checked){let c;try{c=JSON.parse($('commentEditor').value);}catch{throw Error('Comments JSON is invalid. Correct it or uncheck Include comments.');}
    if(!Array.isArray(c)||c.some(x=>!x||typeof x.body!=='string'))throw Error('Comments must be an array with a string body for each entry.');
    t.comments=c.map(x=>({author:String(x.author||''),created:String(x.created||''),body:x.body}));
  }else t.comments=[];
  t.exportedAt=new Date().toISOString();return t;
}
async function download(){
  const t=editedTicket(),selected=new Set([...document.querySelectorAll('#files input:checked')].map(x=>Number(x.dataset.index))),files=[];
  let total=0;
  for(let i=0;i<t.attachments.length;i++){
    const a=t.attachments[i];a.status='excluded by user';if(!selected.has(i)){delete a.url;continue;}
    status(`Downloading attachment ${i+1} of ${t.attachments.length}: ${a.name}`);
    try{const data=await fetchFile(a,150*1048576-total);total+=data.length;a.path=`attachments/${String(i+1).padStart(3,'0')}-${safeName(a.name)}`;a.status='downloaded';a.bytes=data.length;a.sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data))).map(b=>b.toString(16).padStart(2,'0')).join('');files.push({name:a.path,data});}
    catch(e){a.status=`FAILED: ${e.message}`;t.warnings.push(`Attachment ${a.name}: ${e.message}`);}
    // Signed attachment URLs are not needed by recipients.
    delete a.url;
  }
  const report={exportedAt:t.exportedAt,mode:t.mode,provider:t.provider,warnings:t.warnings,downloaded:t.attachments.filter(a=>a.status==='downloaded').length,failed:t.attachments.filter(a=>a.status.startsWith('FAILED')).length,excluded:t.attachments.filter(a=>a.status==='excluded by user').length,attachments:t.attachments};
  if(report.failed&&!$('incomplete').checked){
    t.attachments.filter(a=>a.status.startsWith('FAILED')).forEach(a=>warn(`${a.name}: ${a.status}`));
    throw Error(`${report.failed} attachment(s) failed. No ZIP saved. Grant host access and retry, or explicitly allow an incomplete ZIP.`);
  }
  files.push({name:'ticket.html',data:renderTicket(t)},{name:'ticket.md',data:markdown(t)},{name:'ticket.json',data:JSON.stringify(t,null,2)},{name:'export-report.json',data:JSON.stringify(report,null,2)},{name:'AI-INSTRUCTIONS.txt',data:aiPrompt(t,$('task').value)});
  const blob=zip(files),url=URL.createObjectURL(blob);urls.add(url);
  const id=await chrome.downloads.download({url,filename:`TicketPack/${safeName(t.key)}-${Date.now()}.zip`,saveAs:false});
  status(`ZIP download requested. ${report.downloaded} files packed; ${report.failed} failed; ${report.excluded} excluded. Check Chrome downloads for completion.`);
  if(report.failed)warn(`${report.failed} attachments could not be downloaded. See export-report.json inside the ZIP.`);
  return {t,id};
}
async function run(handoff){
  if(busy||!ticket)return;
  // Capture clipboard write promise within the user gesture.
  let clip=null;if(handoff){try{clip=navigator.clipboard.writeText(aiPrompt(editedTicket(),$('task').value));clip.catch(()=>{});}catch{}}
  setBusy(true);
  try{await download();if(handoff){try{await clip;}catch{warn('Could not copy prompt. AI-INSTRUCTIONS.txt in the ZIP contains the prompt.');}
    await chrome.tabs.create({url:$('ai').value});warn('Attach the downloaded ZIP to the AI conversation and paste the copied prompt. No file was uploaded automatically.');}}
  catch(e){status(`Export failed: ${e.message}`);}finally{setBusy(false);}
}
$('capture').onclick=capture;$('download').onclick=()=>run(false);$('handoff').onclick=()=>run(true);
window.addEventListener('unload',()=>urls.forEach(x=>URL.revokeObjectURL(x)));
try{sourceTab=await chrome.tabs.get(tabId);$('source').textContent=sourceTab.url||'Source URL unavailable';$('provider').value=detect(sourceTab.url,sourceTab.title);await capture();if(ticket&&new URLSearchParams(location.search).get('auto')==='1')await run(false);}catch{status('Open a ticket, then click the TicketPack extension icon to start.');}
