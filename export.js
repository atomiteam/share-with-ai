import {detect,aiPrompt} from './core.js';
import {safeName} from './zip.js';
import {fetchAttachment,validateAttachment} from './attachments.js';
import {readAttachmentInTab,requireSourceResult} from './source-fetch.js';
import {buildTicketZip} from './workflow.js';
import {saveZipDownload} from './downloads.js';
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search),tabId=Number(params.get('tab'));
const APPS={chatgpt:{name:'ChatGPT',url:'https://chatgpt.com/'},claude:{name:'Claude',url:'https://claude.ai/'},gemini:{name:'Gemini',url:'https://gemini.google.com/'},copilot:{name:'Microsoft Copilot',url:'https://copilot.microsoft.com/'}};
let busy=false,ticket=null,lastExport=null;const urls=new Set();
function feedback(kind,title,text){$('feedback').dataset.kind=kind;$('status-title').textContent=title;$('status').textContent=text;$('status-icon').textContent=kind==='success'?'✓':kind==='error'?'!':kind==='working'?'◌':'○';}
function setBusy(value){busy=value;$('download').disabled=value;$('handoff').disabled=value;document.querySelectorAll('[data-ai]').forEach(b=>b.disabled=value);if(value){$('ai-menu').hidden=true;$('handoff').setAttribute('aria-expanded','false');}}
function notice(message){$('warnings').hidden=false;const item=document.createElement('li');item.textContent=message;$('warning-list').append(item);}
async function inject(func,args=[]){const result=await chrome.scripting.executeScript({target:{tabId},func,args});if(!result[0]||result[0].error||result[0].result==null)throw Error('The source ticket tab returned no result. Reopen it and retry.');return result[0].result;}
async function captureTicket(){
  const tab=await chrome.tabs.get(tabId);if(!/^https?:\/\//.test(tab.url||''))throw Error('Open an individual ticket in your browser, then click the extension icon.');
  const provider=detect(tab.url,tab.title),url=new URL(tab.url);
  if(provider.startsWith('Jira')&&!(/\/(?:browse|requests)\/[A-Z][A-Z0-9_]*-\d+/i.test(url.pathname)||url.searchParams.get('selectedIssue')))
    throw Error('Open an individual Jira ticket first. A dashboard, ticket list or “For you” page cannot be exported as a ticket.');
  if(provider==='GitHub'&&!/\/issues\/\d+/.test(url.pathname))throw Error('Open an individual GitHub issue first.');
  if(provider==='GitLab'&&!/\/-\/issues\/\d+/.test(url.pathname))throw Error('Open an individual GitLab issue first.');
  if(provider==='Azure DevOps'&&!/\/_workitems\/edit\/\d+/.test(url.pathname))throw Error('Open an individual Azure DevOps work item first.');
  await chrome.scripting.executeScript({target:{tabId},files:['collector.js']});
  const result=await inject(async(p)=>globalThis.ticketpackCollect(p,true),[provider]);
  if(!Array.isArray(result.attachments)||!Array.isArray(result.comments))throw Error('Ticket capture returned invalid data. Reopen the ticket and retry.');
  result.warnings||=[];return result;
}
async function fetchFile(a,remaining){
  const u=new URL(a.url),origin=new URL(ticket.url).origin,limit=Math.min(25*1048576,remaining);
  if(a.size>limit)throw Error('File exceeds the 25 MiB per-file or remaining 150 MiB export limit');
  if(u.origin!==origin&&!await chrome.permissions.contains({origins:[`${u.origin}/*`]}))throw Error(`Permission needed for ${u.hostname}. Use Allow access below, then retry.`);
  let extensionError;
  try{return await fetchAttachment(a.url,limit,fetch,{name:a.name,expectedSize:a.size});}catch(e){extensionError=e;}
  if(u.origin===origin){
    try{
      const result=requireSourceResult(await inject(readAttachmentInTab,[a.url,limit]));
      if(result.contentType.includes('text/html')&&!/\.html?$/i.test(a.name))throw Error('Received an HTML login/error page instead of the attachment');
      return validateAttachment(Uint8Array.from(atob(result.base64),c=>c.charCodeAt(0)),{name:a.name,expectedSize:a.size,status:result.status,contentRange:result.contentRange,contentType:result.contentType});
    }catch(e){throw Error(`Extension download: ${extensionError.message}. Source-tab download: ${e.message}`);}
  }
  throw extensionError;
}
function showError(error){
  $('errors').hidden=false;$('error-summary').textContent=error.message;
  const failures=error.failures||[];
  for(const f of failures){const li=document.createElement('li');li.textContent=`${f.name}: ${f.message}`;$('error-list').append(li);}
  for(const origin of new Set(failures.map(f=>f.origin))){
    const b=document.createElement('button');b.type='button';b.textContent=`Allow access to ${new URL(origin).hostname}`;
    b.onclick=async()=>{try{const allowed=await chrome.permissions.request({origins:[`${origin}/*`]});b.textContent=allowed?'Access allowed — choose Download to retry':'Access declined';}catch(e){b.textContent=e.message;}};
    $('permissions').append(b);
  }
  feedback('error','Action failed',lastExport?'The ZIP is saved, but the AI handoff did not finish. Choose Share with AI to retry.':'No completed export is available. See the error below, then retry.');
}
async function run(appKey=null){
  if(busy)return;
  const app=appKey?APPS[appKey]:null;if(appKey&&!app)return;
  let clipboard=null;
  // Start within the AI-menu click's user gesture, before asynchronous downloads.
  if(app){try{clipboard=navigator.clipboard.writeText(aiPrompt(lastExport?.ticket||{key:'this ticket'}));clipboard.catch(()=>{});}catch{}}
  setBusy(true);$('errors').hidden=true;$('error-list').replaceChildren();$('permissions').replaceChildren();$('warning-list').replaceChildren();$('warnings').hidden=true;
  try{
    if(!app||!lastExport){
      lastExport=null;feedback('working','Preparing export','Reading the ticket and collecting its attachments…');
      ticket=await captureTicket();ticket.warnings.forEach(notice);
      const result=await buildTicketZip(ticket,{fetchFile,onProgress:text=>feedback('working','Preparing export',text)});
      const url=URL.createObjectURL(result.blob);urls.add(url);
      feedback('working','Saving ZIP','Waiting for Chrome to finish the download…');
      await saveZipDownload({url,filename:`Share-with-AI/${safeName(result.ticket.key)}-${Date.now()}.zip`,saveAs:false});
      lastExport=result;URL.revokeObjectURL(url);urls.delete(url);
    }else lastExport.ticket.warnings.forEach(notice);
    if(app){
      let copied=false;try{if(clipboard){await clipboard;copied=true;}}catch{}
      feedback('working','Opening AI app',`Your ZIP is saved. Opening ${app.name}…`);
      await chrome.tabs.create({url:app.url});
      if(!copied)notice('The prompt could not be copied. Extract AI-INSTRUCTIONS.txt from the ZIP and paste its contents into your AI app.');
      feedback('success','Ready to share',`ZIP downloaded and ${app.name} opened.${copied?' Prompt copied.':''} Attach the ZIP yourself${copied?' and paste the prompt':''} to continue. No file was uploaded automatically.`);
    }else feedback('success','Download complete',`Your ZIP is saved in Chrome downloads. ${lastExport.count} attachment${lastExport.count===1?'':'s'} included. Open the ZIP to see the exported content.`);
  }catch(error){showError(error);}finally{setBusy(false);}
}
$('download').onclick=()=>run();
$('handoff').onclick=()=>{const open=$('ai-menu').hidden;$('ai-menu').hidden=!open;$('handoff').setAttribute('aria-expanded',String(open));};
for(const b of document.querySelectorAll('[data-ai]'))b.onclick=()=>run(b.dataset.ai);
document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('ai-menu').hidden=true;$('handoff').setAttribute('aria-expanded','false');$('handoff').focus();}});
window.addEventListener('unload',()=>urls.forEach(u=>URL.revokeObjectURL(u)));
if(params.get('auto')==='1')await run();else feedback('ready','Ready','Choose Download or Share with AI. Keep the original ticket tab open.');
