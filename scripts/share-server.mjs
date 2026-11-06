// A separate, restricted public ingress. The private app and its encrypted data stay in place.
import http from 'node:http';
import {pathToFileURL} from 'node:url';

const readRoutes = /^(?:\/api\/(?:health|workspace|staff|categories|overview|integrations|export|searches|ai\/usage)|\/api\/leads(?:\/[^/]+(?:\/outreach)?)?)$/;
const writeRoutes = /^(?:\/api\/(?:discovery|leads|leads\/import|searches|ai\/(?:test|build-search|extract-leads|draft-message|prepare-lead))|\/api\/leads\/[^/]+\/(?:outreach|restore))$/;
const extensionRoutes = /^\/api\/browser-capture\/(?:pair|status|import|import-many)$/;
export function allowed(method, path) {
  if(extensionRoutes.test(path))return ['GET','POST','OPTIONS'].includes(method);
  if(method==='GET'||method==='HEAD')return !path.startsWith('/api')&&!path.startsWith('/auth') || readRoutes.test(path);
  if(method==='POST')return writeRoutes.test(path);
  if(method==='PUT'||method==='DELETE')return /^\/api\/leads\/[^/]+$/.test(path) || method==='DELETE'&&/^\/api\/searches\/[^/]+$/.test(path);
  return false;
}
export function createShareServer({origin, upstream='http://127.0.0.1:5084'}) {
  const publicUrl=new URL(origin);
  if(publicUrl.protocol!=='https:'||!publicUrl.hostname.endsWith('.trycloudflare.com')||publicUrl.port||publicUrl.pathname!=='/')throw new Error('A valid HTTPS TryCloudflare origin is required.');
  let windowStart=Date.now(), aiCount=0;
  return http.createServer(async(req,res)=>{
    const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
    try {
      const url=new URL(req.url,'http://localhost');
      if(url.origin!=='http://localhost')return json(400,{error:'Invalid request target.'});
      // Decode once for matching, and reject encoded or normalized path bypasses.
      if(url.pathname.includes('%')||url.pathname.includes('\\')||url.pathname!==req.url.split('?')[0])return json(400,{error:'Invalid path.'});
      const path=url.pathname, method=req.method;
      if(!allowed(method,path))return json(403,{error:'Manage credentials, connections, pairing codes and workspace administration from the owner’s local app.'});
      const extension=extensionRoutes.test(path);
      if(!extension && req.headers.origin && req.headers.origin!==publicUrl.origin)return json(403,{error:'Cross-origin request rejected.'});
      if(!extension && !['GET','HEAD'].includes(method) && req.headers['x-lead-desk']!=='1')return json(403,{error:'Refresh the app before trying again.'});
      if(method==='POST'&&(path.startsWith('/api/ai/')||path==='/api/browser-capture/import')) {
        if(Date.now()-windowStart>60000){windowStart=Date.now();aiCount=0;}
        if(++aiCount>6)return json(429,{error:'The shared showcase allows six AI requests per minute. Please wait a moment.'});
      }
      const chunks=[];let size=0;
      for await(const chunk of req){size+=chunk.length;if(size>2000000)return json(413,{error:'Request is too large.'});chunks.push(chunk);}
      const headers={};
      for(const name of ['content-type','x-lead-desk','x-lead-desk-extension','x-lead-desk-capture','access-control-request-method','access-control-request-headers'])if(req.headers[name])headers[name]=req.headers[name];
      // The upstream retains its localhost host filter and same-origin checks.
      if(extension&&req.headers.origin)headers.origin=req.headers.origin;
      else if(!['GET','HEAD'].includes(method))headers.origin=upstream;
      const response=await fetch(upstream+url.pathname+url.search,{method,headers,body:chunks.length?Buffer.concat(chunks):undefined,redirect:'manual',signal:AbortSignal.timeout(115000)});
      if(path==='/api/workspace'&&response.ok){const data=await response.json();data.publicShare=true;data.access='showcase';data.user.email='';return json(200,data);}
      if(path==='/api/integrations'&&response.ok){const data=await response.json();if(data.linkedin)data.linkedin.email='';data.callback='';return json(200,data);}
      if(path==='/api/staff'&&response.ok){const data=await response.json();return json(200,data.map(s=>({...s,email:''})));}
      for(const [key,value] of response.headers)if(!['set-cookie','connection','transfer-encoding','content-length','content-encoding'].includes(key))res.setHeader(key,value);
      res.setHeader('X-Robots-Tag','noindex, nofollow');
      res.statusCode=response.status;
      res.end(Buffer.from(await response.arrayBuffer()));
    }catch(error){json(502,{error:error.name==='TimeoutError'?'The request timed out. Please try again.':'The owner’s app is unavailable. Please try again later.'});}
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const server=createShareServer({origin:process.env.LEAD_DESK_SHARE_ORIGIN,upstream:'http://127.0.0.1:5084'});
  server.listen(5085,'127.0.0.1',()=>console.log('Showcase gateway ready on 127.0.0.1:5085'));
}
