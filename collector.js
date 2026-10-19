// Runs in Chrome's isolated world on the source tab. Read-only GET requests only.
globalThis.ticketpackCollect = async function(provider, preferAPI) {
  const url=location.href, u=new URL(url), warnings=[];
  const plain=v=>{
    if(v==null) return '';
    if(typeof v==='object') {
      if(v.type==='text') return v.text||'';
      if(v.type==='hardBreak') return '\n';
      if(v.content) return v.content.map(plain).join('')+(/paragraph|heading|listItem|codeBlock/.test(v.type)?'\n':'');
      return JSON.stringify(v);
    }
    const d=new DOMParser().parseFromString(String(v),'text/html');
    d.querySelectorAll('script,style,iframe').forEach(x=>x.remove());
    d.querySelectorAll('br').forEach(x=>x.replaceWith('\n'));
    d.querySelectorAll('p,div,li').forEach(x=>x.append('\n'));
    return d.body.textContent.trim();
  };
  const text=s=>document.querySelector(s)?.innerText?.trim()||'';
  const get=async path=>{
    const target=new URL(path,location.origin);
    const r=await fetch(target.href,{credentials:target.origin===location.origin?'include':'omit',headers:{Accept:'application/json'},signal:AbortSignal.timeout(25000)});
    if(!r.ok) throw Error(`API returned HTTP ${r.status}`);
    if(!r.headers.get('content-type')?.includes('json')) throw Error('API returned a sign-in or non-JSON page');
    return r.json();
  };
  const out={schemaVersion:1,provider,url,key:'ticket',title:document.title,description:'',fields:{},comments:[],attachments:[],warnings,mode:'visible-page',exportedAt:new Date().toISOString()};
  const add=(link,name)=>{
    try {
      const v=new URL(link,url);if(!/^https?:$/.test(v.protocol))return;
      if(provider.startsWith('Jira')&&v.origin===u.origin&&/(?:^|\.)atlassian\.net$/.test(u.hostname)){
        const id=v.pathname.match(/\/attachment\/content\/(\d+)/)?.[1]||v.pathname.match(/\/secure\/attachment\/(\d+)/)?.[1];
        if(id){v.pathname=`/rest/api/3/attachment/content/${id}`;v.search='?redirect=false';}
      }
      const existing=out.attachments.find(x=>x.url===v.href);if(existing)return existing;
      const item={url:v.href,name:name||decodeURIComponent(v.pathname.split('/').pop())||'attachment',status:'pending'};
      out.attachments.push(item);return item;
    }catch{}
  };
  function discoverVisibleAttachments() {
    // Attachment endpoints and explicit download links are valid for any file type.
    // Do not restrict discovery to a small filename-extension allowlist.
    for(const el of document.querySelectorAll('a[href], [data-download-url], [data-attachment-url]')) {
      const link=el.getAttribute('data-download-url')||el.getAttribute('data-attachment-url')||el.href;
      if(!link)continue;
      const explicit=el.hasAttribute('download')||el.hasAttribute('data-download-url')||el.hasAttribute('data-attachment-url');
      const endpoint=/\/(?:secure\/attachment|attachments?|uploads|user-attachments|file_attachments|sys_attachment\.do)(?:[/?]|$)/i.test(link);
      const filename=/\.(?:mp4|m4v|mov|webm|avi|mkv|txt|log|bin|dat|dmp|dump|gz|tgz|tar|7z|rar|zip|csv|json|xml|yaml|yml|har|pcap|pcapng|pdf|docx?|xlsx?)(?:$|[?#])/i.test(link);
      if(explicit||endpoint||filename) add(link,el.getAttribute('download')||el.getAttribute('data-filename')||el.textContent?.trim()||undefined);
    }
    for(const el of document.querySelectorAll('video[src], video source[src]')) {
      const src=el.currentSrc||el.src||el.getAttribute('src');if(!src)continue;
      if(src.startsWith('blob:')||/\.(m3u8|mpd)(?:$|\?)/i.test(src)) {
        const message='A streaming/blob video preview was detected. Its original attachment download link is required; the preview cannot be exported as an MP4.';
        if(!warnings.includes(message))warnings.push(message);
      }else add(src,el.getAttribute('download')||undefined);
    }
  }
  const linksIn=(body,base=url)=>{
    const re=/(?:!?\[[^\]]*\]\(([^\s)]+)(?:\s+"[^"]*")?\))|(?:https?:\/\/[^\s<>"\])]+)/g;
    for(const m of String(body||'').matchAll(re)) {
      try {let raw=m[1]||m[0];
        if(provider==='GitLab' && raw.startsWith('/uploads/')) raw=new URL(base).pathname.replace(/\/$/,'')+raw;
        const link=new URL(raw,base);
        if(/\/uploads\/|\/user-attachments\/|\/files\/|\/attachments\/|\/assets\/|\.(mp4|m4v|mov|webm|avi|mkv|png|jpe?g|gif|webp|pdf|zip|txt|log|csv|json|har|docx?|xlsx?)(?:$|\?)/i.test(link.href))add(link.href);
      }catch{}
    }
  };
  const comments=async(fn)=>{try{await fn();}catch(e){warnings.push(`Comments may be incomplete: ${e.message}`);}};
  if(preferAPI) try {
    if(provider.startsWith('Jira')) {
      const key=u.pathname.match(/\/browse\/([A-Z][A-Z0-9_]*-\d+)/i)?.[1]||u.searchParams.get('selectedIssue')||u.pathname.match(/\/requests\/([A-Z][A-Z0-9_]*-\d+)/i)?.[1];
      if(!key)throw Error('Open the individual Jira ticket first');
      const prefix=u.pathname.includes('/browse/')?u.pathname.split('/browse/')[0]:'';
      let root=`${prefix}/rest/api/3`, issue;
      try {issue=await get(`${root}/issue/${encodeURIComponent(key)}?fields=*all`);}catch{root=`${prefix}/rest/api/2`;issue=await get(`${root}/issue/${encodeURIComponent(key)}?fields=*all`);}
      const f=issue.fields||{};out.key=issue.key;out.title=f.summary;out.description=plain(f.description);
      for(const [k,v] of Object.entries(f))if(!['description','comment','attachment'].includes(k)&&v!=null)out.fields[k]=v;
      await comments(async()=>{for(let start=0,page=0;page<100;page++){
        const data=await get(`${root}/issue/${encodeURIComponent(key)}/comment?startAt=${start}&maxResults=100`), rows=data.comments||[];
        out.comments.push(...rows.map(c=>({author:c.author?.displayName||'Unknown',created:c.created||'',body:plain(c.body)})));
        start+=rows.length;if(!rows.length||start>=data.total||data.isLast)break;if(page===99)warnings.push('Comment limit reached (100 pages).');
      }});
      (f.attachment||[]).forEach(a=>{
        const item=add(a.content||`${u.origin}${root}/attachment/content/${a.id}`,a.filename);
        if(item){item.size=a.size;item.mimeType=a.mimeType;}
      });
      discoverVisibleAttachments();out.mode='api';return out;
    }
    if(provider==='GitLab') {
      const match=u.pathname.match(/^(.*?)\/-\/issues\/(\d+)/);if(!match)throw Error('Open a GitLab issue URL');
      const project=match[1].replace(/^\//,''), root=`/api/v4/projects/${encodeURIComponent(project)}/issues/${match[2]}`;
      const issue=await get(root);out.key=`${project.replaceAll('/','-')}-${issue.iid}`;out.title=issue.title;out.description=issue.description||'';
      out.fields={state:issue.state,labels:issue.labels,author:issue.author?.name,assignees:issue.assignees?.map(x=>x.name),created:issue.created_at,updated:issue.updated_at};
      await comments(async()=>{for(let page=1;page<=100;page++){const rows=await get(`${root}/notes?per_page=100&page=${page}&sort=asc`);
        out.comments.push(...rows.map(c=>({author:c.author?.name||'Unknown',created:c.created_at,body:c.body||''})));if(rows.length<100)break;if(page===100)warnings.push('Comment limit reached (100 pages).');
      }});
      [out.description,...out.comments.map(c=>c.body)].forEach(b=>linksIn(b,`${u.origin}/${project}/`));discoverVisibleAttachments();out.mode='api';return out;
    }
    if(provider==='GitHub') {
      const m=u.pathname.match(/^\/([^/]+)\/([^/]+)\/issues\/(\d+)/);if(!m)throw Error('Open a GitHub issue URL');
      const host=u.hostname==='github.com'?'https://api.github.com':`${u.origin}/api/v3`;
      const root=`${host}/repos/${m[1]}/${m[2]}/issues/${m[3]}`, issue=await get(root);
      out.key=`${m[1]}-${m[2]}-${m[3]}`;out.title=issue.title;out.description=issue.body||'';
      out.fields={state:issue.state,labels:issue.labels?.map(x=>x.name),author:issue.user?.login,assignees:issue.assignees?.map(x=>x.login),created:issue.created_at,updated:issue.updated_at};
      await comments(async()=>{for(let page=1;page<=100;page++){const rows=await get(`${root}/comments?per_page=100&page=${page}`);
        out.comments.push(...rows.map(c=>({author:c.user?.login||'Unknown',created:c.created_at,body:c.body||''})));if(rows.length<100)break;if(page===100)warnings.push('Comment limit reached (100 pages).');
      }});
      [out.description,...out.comments.map(c=>c.body)].forEach(b=>linksIn(b));discoverVisibleAttachments();out.mode='api';return out;
    }
    if(provider==='Azure DevOps') {
      const m=u.pathname.match(/^(.*?)\/_workitems\/edit\/(\d+)/);if(!m)throw Error('Open the work item in its own URL');
      const root=`${m[1]}/_apis/wit/workitems/${m[2]}`, issue=await get(`${root}?$expand=relations&api-version=7.1`),f=issue.fields||{};
      out.key=`ADO-${issue.id}`;out.title=f['System.Title'];out.description=plain(f['System.Description']||f['Microsoft.VSTS.TCM.ReproSteps']);out.fields=f;
      await comments(async()=>{let token='';for(let page=0;page<100;page++){
        const data=await get(`${root}/comments?api-version=7.1-preview.4&$top=200${token?'&continuationToken='+encodeURIComponent(token):''}`);
        out.comments.push(...(data.comments||[]).map(c=>({author:c.createdBy?.displayName||'Unknown',created:c.createdDate,body:plain(c.text)})));
        token=data.continuationToken;if(!token)break;if(page===99)warnings.push('Comment limit reached (100 pages).');
      }});
      (issue.relations||[]).filter(r=>r.rel==='AttachedFile').forEach(a=>add(a.url+(a.url.includes('?')?'&':'?')+'api-version=7.1',a.attributes?.name));
      discoverVisibleAttachments();out.mode='api';return out;
    }
  } catch(e) {warnings.push(`API export unavailable: ${e.message}. Capturing visible content instead.`);out.comments=[];out.attachments=[];out.fields={};}
  // Explicitly partial fallback. Selectors are heuristics, not claims of complete exports.
  const profiles={
    'Jira / Jira Service Management':{root:'#issue-content, [data-testid="issue.views.issue-base.foundation.content.content"], main',title:'#summary-val, h1',description:'#description-val, [data-testid="issue.views.field.rich-text.description" ]',comments:'.issue-comment, [data-testid="issue-comment-base"]'},
    'GitHub':{root:'main',title:'.js-issue-title, [data-testid="issue-title"]',description:'.js-issue-body, [data-testid="issue-body"]',comments:'.timeline-comment .comment-body, [data-testid="issue-comment"]'},
    'GitLab':{root:'.issue-details, main',title:'.title, h1',description:'.description .md',comments:'.note-text'},
    'Azure DevOps':{root:'.work-item-form, [role="main"]',title:'input[aria-label="Title"], h1',description:'.work-item-form',comments:'.discussion-comment'},
    'Linear':{root:'[role="dialog"], main, [role="main"]',title:'h1, [contenteditable="true"]',description:'.ProseMirror',comments:'[data-testid="comment"]'},
    'YouTrack':{root:'main, [role="main"]',title:'h1',description:'[data-test="issue-description"], .issue-description',comments:'.comment, [data-test="comment"]'},
    'Redmine':{root:'#content',title:'.subject h3, h2',description:'.issue .description',comments:'.journal .wiki'},
    'Bugzilla':{root:'#bugzilla-body',title:'#short_desc_nonedit_display, #short_desc',description:'.bz_first_comment .bz_comment_text',comments:'.bz_comment:not(.bz_first_comment) .bz_comment_text'},
    'ServiceNow':{root:'main, [role="main"], form',title:'h1, input[id$=".short_description"]',description:'textarea[id$=".description"]',comments:'.sn-card-component'},
    'Zendesk':{root:'main, [role="main"]',title:'h1, [data-test-id="ticket-form-subject"]',description:'[data-test-id="ticket-comment"]',comments:'[data-test-id="comment"]'},
    'Freshdesk / Freshservice':{root:'main, [role="main"], #ticket-details',title:'h1, .ticket-subject',description:'.ticket-description, .ticket-details__description',comments:'.conversation, .ticket-note'},
    'Salesforce Service Cloud':{root:'main, [role="main"], .oneRecordHomeFlexipage',title:'h1',description:'[data-field-id$="Description"]',comments:'.feedItem'}
  };
  const profile=profiles[provider]||{root:'main, [role="main"], article',title:'h1',description:'',comments:''};
  const root=document.querySelector(profile.root)||document.body;
  const visibleText=el=>{if(!el)return '';if(el.matches('input,textarea'))return el.value||'';return el.innerText?.trim()||'';};
  out.title=visibleText(document.querySelector(profile.title))||document.title;
  out.description=(profile.description&&visibleText(document.querySelector(profile.description)))||visibleText(root);
  if(profile.comments)out.comments=[...root.querySelectorAll(profile.comments)].filter(el=>el.getClientRects().length).map(el=>({author:'See comment text',created:'',body:visibleText(el)})).filter(c=>c.body);
  out.key=u.pathname.match(/(?:browse|issue)\/([A-Z][A-Z0-9_]*-\d+)/i)?.[1]||u.pathname.match(/(?:issues|edit|tickets|cases)\/(\d+)/i)?.[1]||u.searchParams.get('id')||'ticket';
  discoverVisibleAttachments();
  root.querySelectorAll('a[href],img[src]').forEach(el=>{
    if(!el.getClientRects().length)return;
    const link=el.href||el.src;
    if(/attachment|\/uploads\/|\/user-attachments\/|\/secure\/attachment\/|\/assets\/|\.(mp4|m4v|mov|webm|avi|mkv|png|jpe?g|gif|webp|pdf|zip|txt|log|csv|json|har|docx?|xlsx?)(?:$|\?)/i.test(link))add(link,el.innerText?.trim()||el.getAttribute('download')||undefined);
  });
  warnings.push('PARTIAL: visible-page capture only. Expand all comments and sections first. Hidden, unloaded, iframe and shadow DOM content may be missing. Check the exported ZIP for the captured content.');
  if(document.querySelector('iframe'))warnings.push('This page contains frames. Ticket content inside a frame may not have been captured. Open the ticket frame directly if the preview is empty.');
  return out;
};
