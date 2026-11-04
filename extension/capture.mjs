export const APP_URLS = ['https://localhost:7443', 'http://127.0.0.1:5080'];
export function capturePayload(text, pageUrl) {
  let url;
  try {url=new URL(pageUrl);} catch {throw new Error('Open a LinkedIn profile or an individual post first.');}
  if(url.protocol!=='https:' || url.hostname!=='www.linkedin.com' || !/^\/(in\/|posts\/|feed\/update\/)/.test(url.pathname))
    throw new Error('Open a LinkedIn profile or individual post. Capture does not run on messages, jobs, feeds or other websites.');
  text=(text||'').trim();
  if(text.length<12)throw new Error('First select the person’s name, headline and relevant post text on LinkedIn. Then click the Lead Desk icon, or right-click the selection and choose Save to Lead Desk.');
  if(text.length>35000)throw new Error('Select a smaller passage: at most 35,000 characters.');
  return {text,sourceUrl:url.origin+url.pathname};
}
export function appUrl(value) {
  if(!APP_URLS.includes(value))throw new Error('Choose one of the local Lead Desk addresses.');
  return value;
}
export async function request(base,path,body,token,extensionId) {
  const response=await fetch(appUrl(base)+'/api/browser-capture/'+path,{
    method:body===undefined?'GET':'POST',credentials:'omit',
    headers:{'Content-Type':'application/json','X-Lead-Desk-Extension':extensionId,...(token?{'X-Lead-Desk-Capture':token}:{})},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(100000)
  });
  let result;try{result=await response.json();}catch{throw new Error('Lead Desk returned an invalid response. Check that the app is running.');}
  if(!response.ok)throw new Error(result.error||'Lead Desk could not complete the capture.');
  return result;
}
