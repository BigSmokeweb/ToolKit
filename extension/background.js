import {capturePayload} from './capture.mjs';
const MENU='lead-desk-save-selection';
const active=new Map();
async function icon() {
  const canvas=new OffscreenCanvas(32,32),c=canvas.getContext('2d');
  c.fillStyle='#255d4c';c.beginPath();c.roundRect(0,0,32,32,7);c.fill();
  c.fillStyle='#fff';c.font='bold 15px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('LD',16,17);
  await chrome.action.setIcon({imageData:c.getImageData(0,0,32,32)});
  await chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
}
icon().catch(()=>{});
chrome.runtime.onInstalled.addListener(async()=>{
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({id:MENU,title:'Save selected text to Lead Desk',contexts:['selection'],documentUrlPatterns:['https://www.linkedin.com/in/*','https://www.linkedin.com/posts/*','https://www.linkedin.com/feed/update/*']});
  await chrome.runtime.openOptionsPage();
});
async function resultPage(record) {
  const id=crypto.randomUUID();
  await chrome.storage.session.set({[id]:record});
  await chrome.tabs.create({url:chrome.runtime.getURL('result.html')+'?id='+id});
}
async function capture(tab,text,pageUrl) {
  if(active.has(tab.id))return;
  active.set(tab.id,true);
  try {
    const payload=capturePayload(text,pageUrl);
    const {base,token}=await chrome.storage.local.get(['base','token']);
    if(!base||!token){await chrome.runtime.openOptionsPage();return;}
    await chrome.action.setBadgeBackgroundColor({color:'#255d4c'});
    await chrome.action.setBadgeText({tabId:tab.id,text:'…'});
    // A foreground result page owns the request so a slow AI response cannot outlive the service worker.
    await resultPage({pending:true,base,payload,tabId:tab.id});
  } catch(error) {
    await chrome.action.setBadgeText({tabId:tab.id,text:'!'});
    await resultPage({ok:false,error:error.message||'Capture failed. Check the local app and its HTTPS certificate.'});
  } finally {active.delete(tab.id);}
}
chrome.action.onClicked.addListener(async tab=>{
  try {
    // activeTab grants access only after this explicit toolbar click. No background page reading.
    const [{result}]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>({text:window.getSelection()?.toString()||'',url:location.href})});
    await capture(tab,result.text,result.url);
  } catch(error) {await resultPage({ok:false,error:error.message||'This browser page cannot be captured.'});}
});
chrome.contextMenus.onClicked.addListener((info,tab)=>{
  if(info.menuItemId===MENU)capture(tab,info.selectionText,info.pageUrl);
});
