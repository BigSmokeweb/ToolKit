import {request} from './capture.mjs';
import {peopleCsv} from './people.mjs';
const id=new URLSearchParams(location.search).get('id');
let result=id?(await chrome.storage.session.get(id))[id]:null;
const heading=document.querySelector('#heading'),detail=document.querySelector('#detail');
if(result?.pending) {
  heading.textContent=result.bulk?'Adding people to Lead Desk…':'Preparing your lead…';detail.textContent=result.bulk?`${result.payload.people.length} displayed results. Checking duplicates and saving new leads for review. No AI requests or messages are sent.`:'Gemini is extracting the selected facts and suggesting buyer/partner status and category. This can take up to a minute. Nothing will be sent to this person.';
  const job=result;
  try {
    const {token}=await chrome.storage.local.get('token');
    if(!token)throw new Error('Pair the extension in its settings first.');
    const imported=await request(job.base,job.bulk?'import-many':'import',job.payload,token,chrome.runtime.id);
    result={ok:true,bulk:!!job.bulk,base:job.base,...imported};
    if(job.bulk){
      const csv=peopleCsv(job.payload.people.map(p=>({...p,sourceUrl:job.payload.sourceUrl})));
      const download=document.createElement('a'); download.className='button secondary';download.textContent='Download captured people as CSV';download.download='lead-desk-people-'+new Date().toISOString().slice(0,10)+'.csv';download.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));document.querySelector('main').append(download);
      // Raw result-card text stays only in this result page memory, not saved extension storage.
    }
    await chrome.action.setBadgeText({tabId:job.tabId,text:'OK'}).catch(()=>{});
  }catch(error){result={ok:false,error:error.message||'Capture failed. Check the local app and its trusted HTTPS certificate.'};}
  await chrome.storage.session.set({[id]:result});
}
if(!result){heading.textContent='No capture result';detail.textContent='Return to LinkedIn, select the person’s relevant text and click the LD icon.';}
else if(!result.ok){heading.textContent='Nothing was added';detail.textContent=result.error;}
else if(result.bulk){
  heading.textContent=`${result.imported} ${result.imported===1?'person added':'people added'} to Lead Desk`;
  detail.textContent=`${result.duplicates} already in your pipeline. ${result.total} identifiable results checked. New records are unapproved, with no inferred buying signal or verified contact details.`;
  document.querySelector('#lead').hidden=false;
  document.querySelector('#name').textContent=`${result.imported} added · ${result.duplicates} existing`;
  document.querySelector('#category').textContent='Any other search · review and choose the service';
  document.querySelector('#score').textContent='Review required';
  const open=document.querySelector('#open');open.href=result.base+'/#pipeline';open.textContent='Open people in Lead Desk';
  const list=document.createElement('ul');for(const row of result.records){const li=document.createElement('li');const link=document.createElement('a');link.textContent=row.name+(row.duplicate?' · already present':' · added');link.href=result.base+'/?lead='+encodeURIComponent(row.id)+'#pipeline';li.append(link);list.append(li);}document.querySelector('#lead').append(list);
}
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
