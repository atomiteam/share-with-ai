// Resolve only when Chrome confirms the ZIP has finished saving.
export async function saveZipDownload(options, api=chrome.downloads, timeoutMs=300000) {
  let id, resolveDone, rejectDone, timer;
  const early=new Map();let settled=false;
  const done=new Promise((resolve,reject)=>{resolveDone=resolve;rejectDone=reject;});
  // Avoid an unhandled rejection while the initial Chrome request is pending.
  done.catch(()=>{});
  const finish=(error)=>{if(settled)return;settled=true;clearTimeout(timer);api.onChanged.removeListener(changed);error?rejectDone(error):resolveDone(id);};
  const inspect=d=>{
    if(d.state?.current==='complete')finish();
    else if(d.state?.current==='interrupted'||d.error?.current)finish(Error(`Download interrupted: ${d.error?.current||'cancelled or blocked by Chrome'}`));
  };
  const changed=d=>{if(id===undefined){early.set(d.id,d);return;}if(d.id===id)inspect(d);};
  api.onChanged.addListener(changed);
  try {
    id=await api.download(options);
    if(!Number.isInteger(id))throw Error('Chrome did not start the ZIP download');
    timer=setTimeout(()=>finish(Error('Chrome has not confirmed completion. Check Downloads for a pending save prompt or blocked download.')),timeoutMs);
    if(early.has(id))inspect(early.get(id));
    if(!settled){const items=await api.search({id});const item=items[0];if(item)inspect({state:{current:item.state},error:item.error?{current:item.error}:undefined});}
    return await done;
  }catch(e){finish(e);throw e;}
  finally{clearTimeout(timer);api.onChanged.removeListener(changed);}
}
