import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../collector.js',import.meta.url),'utf8');
function harness(url,handler,links=[]){
 const requests=[];
 const root={innerText:'Visible fallback text',querySelectorAll:()=>[],matches:()=>false};
 class DOMParser {parseFromString(value){return {body:{textContent:value},querySelectorAll:()=>[]};}}
 const context=vm.createContext({URL,AbortSignal,DOMParser,location:new URL(url),document:{title:'Test ticket',body:root,querySelector:()=>null,querySelectorAll:()=>links},fetch:async(url,options)=>{
  requests.push({url,options});const data=await handler(new URL(url),options);return {ok:true,headers:{get:()=> 'application/json'},json:async()=>data};
 }});
 vm.runInContext(code,context);return {collect:context.ticketpackCollect,requests};
}
test('Jira paginates all comment pages and resolves attachment metadata',async()=>{
 const h=harness('https://example.test/jira/browse/ABC-2',u=>{
  if(u.pathname.endsWith('/comment'))return {total:2,comments:[{author:{displayName:'Sam'},body:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'page '+u.searchParams.get('startAt')}]}]}}]};
  assert.equal(u.pathname,'/jira/rest/api/3/issue/ABC-2');return {key:'ABC-2',fields:{summary:'Title',description:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Description'}]}]},attachment:[{content:'https://example.test/file',filename:'log.txt',size:10}]}};
 });
 const t=await h.collect('Jira / Jira Service Management',true);assert.equal(t.mode,'api');assert.equal(t.comments.length,2);assert.equal(t.attachments[0].name,'log.txt');assert.equal(h.requests.length,3);assert.ok(h.requests.every(r=>r.options.credentials==='include'));
});
test('Jira falls back to REST v2 on Data Center',async()=>{
 const h=harness('https://example.test/browse/A-1',u=>{if(u.pathname.includes('/api/3/'))throw Error('404');if(u.pathname.endsWith('/comment'))return {total:0,comments:[]};return {key:'A-1',fields:{summary:'Server ticket',description:'Hello'}};});
 const t=await h.collect('Jira / Jira Service Management',true);assert.equal(t.mode,'api');assert.equal(t.title,'Server ticket');
});
test('GitLab nested project encodes path and expands project-relative uploads',async()=>{
 const h=harness('https://git.example/team/sub/project/-/issues/8',u=>{
  assert.ok(u.pathname.startsWith('/api/v4/projects/team%2Fsub%2Fproject/issues/8'));
  return u.pathname.endsWith('/notes')?[]:{iid:8,title:'Bug',description:'[log](/uploads/abc/device.log)'};
 });
 const t=await h.collect('GitLab',true);assert.equal(t.mode,'api');assert.equal(t.attachments[0].url,'https://git.example/team/sub/project/uploads/abc/device.log');
});
test('GitHub public API omits credentials and discovers attached assets',async()=>{
 const h=harness('https://github.com/org/repo/issues/7',(u,o)=>{
  assert.equal(u.origin,'https://api.github.com');assert.equal(o.credentials,'omit');return u.pathname.endsWith('/comments')?[]:{title:'Bug',body:'[trace](https://github.com/user-attachments/files/123/a.log)',user:{login:'alex'}};
 });const t=await h.collect('GitHub',true);assert.equal(t.attachments.length,1);assert.equal(t.mode,'api');
});
test('Azure collects continuation pages and attachment relations',async()=>{
 const h=harness('https://dev.azure.com/org/project/_workitems/edit/7',u=>{
  if(u.pathname.endsWith('/comments'))return u.searchParams.has('continuationToken')?{comments:[{text:'Second'}]}:{comments:[{text:'First'}],continuationToken:'next'};
  return {id:7,fields:{'System.Title':'Azure bug','System.Description':'Details'},relations:[{rel:'AttachedFile',url:'https://dev.azure.com/org/project/_apis/wit/attachments/1',attributes:{name:'a.log'}}]};
 });const t=await h.collect('Azure DevOps',true);assert.equal(t.comments.length,2);assert.equal(t.attachments[0].name,'a.log');assert.ok(t.attachments[0].url.endsWith('api-version=7.1'));
});
test('comment page failures preserve collected data and expose incomplete warning',async()=>{
 const h=harness('https://git.example/team/project/-/issues/8',u=>{
  if(u.pathname.endsWith('/notes')){if(u.searchParams.get('page')==='2')throw Error('HTTP 403');return Array.from({length:100},()=>({body:'Comment',author:{name:'Alex'}}));}
  return {iid:8,title:'Bug',description:'Details'};
 });const t=await h.collect('GitLab',true);assert.equal(t.comments.length,100);assert.ok(t.warnings.some(w=>w.includes('incomplete')));
});
test('API failure explicitly falls back to partial visible capture',async()=>{
 const h=harness('https://github.com/org/private/issues/7',()=>{throw Error('HTTP 404');});const t=await h.collect('GitHub',true);
 assert.equal(t.mode,'visible-page');assert.equal(t.description,'Visible fallback text');assert.ok(t.warnings.some(w=>w.includes('PARTIAL')));assert.ok(t.warnings.some(w=>w.includes('API export unavailable')));
});

test('visible discovery includes TXT, binary and extensionless download links',async()=>{
 const link=(href,attrs={})=>({href,textContent:attrs.name||'',getAttribute:k=>attrs[k]??null,hasAttribute:k=>Object.hasOwn(attrs,k)});
 const links=[link('https://example.test/file.txt'),link('https://example.test/capture.bin'),link('https://example.test/download?id=3',{download:'opaque-file'}),link('https://example.test/page')];
 const h=harness('https://example.test/browse/A-1',()=>({key:'A-1',fields:{summary:'Ticket',attachment:[],comment:{}}}),links);
 const t=await h.collect('Jira / Jira Service Management',true);
 assert.equal(t.attachments.length,3);assert.ok(t.attachments.some(a=>a.name==='opaque-file'));
});
test('Jira Cloud uses nonredirecting download endpoint and retains known size',async()=>{
 const link={href:'https://company.atlassian.net/secure/attachment/123/video.mp4',textContent:'video.mp4',getAttribute:()=>null,hasAttribute:()=>false};
 const h=harness('https://company.atlassian.net/browse/A-1',u=>u.pathname.endsWith('/comment')?{total:0,comments:[]}:{key:'A-1',fields:{summary:'Video',attachment:[{id:'123',content:'https://company.atlassian.net/jira/rest/api/3/attachment/content/123',filename:'video.mp4',size:12345}]}},[link]);
 const t=await h.collect('Jira / Jira Service Management',true);assert.equal(t.attachments.length,1);assert.equal(t.attachments[0].url,'https://company.atlassian.net/rest/api/3/attachment/content/123?redirect=false');assert.equal(t.attachments[0].size,12345);
});
