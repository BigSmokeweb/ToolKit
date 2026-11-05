import {appUrl,request} from './capture.mjs';
const base=document.querySelector('#base'),code=document.querySelector('#code'),status=document.querySelector('#status'),pair=document.querySelector('#pair');
const saved=await chrome.storage.local.get(['base','token']);
if(saved.base)base.value=saved.base;
status.textContent=saved.token?'A pairing is saved in this browser. Use Check connection to verify it.':'Open Lead Desk → Settings → Browser Capture and generate a one-time code.';
document.querySelector('#pair-form').addEventListener('submit',async event=>{
  event.preventDefault();pair.disabled=true;status.textContent='Pairing…';
  try {
    const origin=appUrl(base.value.trim());
    if(origin.endsWith('.trycloudflare.com')&&!await chrome.permissions.request({origins:[origin+'/*']}))throw new Error('Allow access to this showcase address to pair the extension.');
    const result=await request(origin,'pair',{code:code.value.trim(),extensionId:chrome.runtime.id},null,chrome.runtime.id);
    await chrome.storage.local.set({base:origin,token:result.token});code.value='';
    status.textContent='Paired. Pin the LD icon. Select the relevant LinkedIn text, then click LD to save a lead.';
  }catch(error){status.textContent=error.message||'Connection failed. Check the app and trusted localhost certificate.';}finally{pair.disabled=false;}
});
document.querySelector('#test').addEventListener('click',async()=>{
  status.textContent='Checking…';try{const s=await chrome.storage.local.get(['base','token']);if(!s.token)throw new Error('Pair the extension first.');await request(s.base,'status',undefined,s.token,chrome.runtime.id);status.textContent='Connected to Lead Desk.';}catch(error){status.textContent=error.message||'Could not reach the app. Make sure it is running and its certificate is trusted.';}
});
document.querySelector('#disconnect').addEventListener('click',async()=>{
  await chrome.storage.local.remove(['token']);status.textContent='Pairing removed from this browser. You can also revoke it in Lead Desk Settings.';
});
