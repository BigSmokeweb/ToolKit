import {request} from './capture.mjs';
const id=new URLSearchParams(location.search).get('id');
let result=id?(await chrome.storage.session.get(id))[id]:null;
const heading=document.querySelector('#heading'),detail=document.querySelector('#detail');
if(result?.pending) {
  heading.textContent='Preparing your lead…';detail.textContent='Gemini is extracting the selected facts and suggesting buyer/partner status and category. This can take up to a minute. Nothing will be sent to this person.';
  const job=result;
  try {
    const {token}=await chrome.storage.local.get('token');
    if(!token)throw new Error('Pair the extension in its settings first.');
    result={ok:true,base:job.base,...await request(job.base,'import',job.payload,token,chrome.runtime.id)};
    await chrome.action.setBadgeText({tabId:job.tabId,text:'OK'}).catch(()=>{});
  }catch(error){result={ok:false,error:error.message||'Capture failed. Check the local app and its trusted HTTPS certificate.'};}
  await chrome.storage.session.set({[id]:result});
}
if(!result){heading.textContent='No capture result';detail.textContent='Return to LinkedIn, select the person’s relevant text and click the LD icon.';}
else if(!result.ok){heading.textContent='Nothing was added';detail.textContent=result.error;}
else {
  heading.textContent=result.duplicate?'Already in your pipeline':'Lead saved for review';
  detail.textContent=result.assessment||'Open the saved record to review the details.';
  document.querySelector('#lead').hidden=false;
  document.querySelector('#name').textContent=result.lead.name;
  document.querySelector('#category').textContent=result.lead.categoryId==='professionals'?'Professional Empanelment':result.lead.categoryId;
  document.querySelector('#score').textContent=String(result.lead.fitScore);
  if(result.duplicate)document.querySelector('#review-note').textContent='Your existing record was kept, including its current details and approval status. No message was sent.';
  const open=document.querySelector('#open');open.href=result.base+'/?lead='+encodeURIComponent(result.lead.id)+'#pipeline';
}
document.querySelector('#settings').addEventListener('click',()=>chrome.runtime.openOptionsPage());
