import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {allowed,createShareServer} from './share-server.mjs';

test('allows normal pipeline and real AI work',()=>{
 for(const [method,path] of [['GET','/api/leads'],['GET','/api/leads/abc/history'],['POST','/api/leads'],['PUT','/api/leads/abc'],['DELETE','/api/leads/abc'],['POST','/api/ai/prepare-lead'],['POST','/api/ai/test'],['POST','/api/browser-capture/import'],['POST','/api/browser-capture/pair'],['GET','/downloads/lead-desk-capture.zip']])assert.equal(allowed(method,path),true,method+' '+path);
});
test('blocks owner-only administrative operations',()=>{
 for(const [method,path] of [['GET','/api/settings'],['PUT','/api/settings'],['DELETE','/api/settings/secrets/geminiKey'],['DELETE','/api/integrations/linkedin'],['POST','/api/integrations/linkedin/start'],['GET','/auth/linkedin/callback'],['POST','/api/browser-capture/pairing-code'],['DELETE','/api/browser-capture/pairing'],['POST','/api/staff'],['POST','/api/categories'],['POST','/api/samples'],['POST','/api/retention/archive'],['DELETE','/api/leads/id/purge']])assert.equal(allowed(method,path),false,method+' '+path);
});
test('gateway validates origins, strips credentials, preserves extension authentication and masks owner email',async()=>{
 let received;
 const upstream=http.createServer((req,res)=>{received={url:req.url,headers:req.headers};res.setHeader('Content-Type','application/json');if(req.url==='/api/workspace')res.end(JSON.stringify({user:{id:'owner',name:'Owner',email:'private@example.test'},access:'open'}));else if(req.url==='/api/integrations')res.end(JSON.stringify({geminiConfigured:true,linkedin:{email:'private@example.test',expired:false},callback:'private-callback'}));else res.end('{}');});
 upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
 const origin='https://sample-demo.trycloudflare.com';
 const gateway=createShareServer({origin,upstream:'http://127.0.0.1:'+upstream.address().port});gateway.listen(0,'127.0.0.1');await once(gateway,'listening');
 const base='http://127.0.0.1:'+gateway.address().port;
 try{
  const workspace=await (await fetch(base+'/api/workspace',{headers:{Cookie:'secret=1',Authorization:'Bearer private'}})).json();assert.equal(workspace.publicShare,true);assert.equal(workspace.user.email,'');assert.equal(received.headers.cookie,undefined);assert.equal(received.headers.authorization,undefined);
  const integration=await(await fetch(base+'/api/integrations')).json();assert.equal(integration.geminiConfigured,true);assert.equal(integration.linkedin.email,'');assert.equal(integration.callback,'');
  assert.equal((await fetch(base+'/api/settings')).status,403);
  assert.equal((await fetch(base+'/api/leads',{method:'POST',headers:{'X-Lead-Desk':'1',Origin:'https://evil.test'}})).status,403);
  assert.equal((await fetch(base+'/api/leads',{method:'POST'})).status,403);
  assert.equal((await fetch(base+'/api/leads',{method:'POST',headers:{'X-Lead-Desk':'1',Origin:origin},body:'{}'})).status,200);assert.equal(received.headers.origin,'http://127.0.0.1:'+upstream.address().port);
  const ext='chrome-extension://'+'a'.repeat(32);assert.equal((await fetch(base+'/api/browser-capture/import',{method:'POST',headers:{Origin:ext,'X-Lead-Desk-Capture':'paired-token','X-Lead-Desk-Extension':'a'.repeat(32)},body:'{}'})).status,200);assert.equal(received.headers.origin,ext);assert.equal(received.headers['x-lead-desk-capture'],'paired-token');
  assert.equal((await fetch(base+'/api/%73ettings')).status,400);
  assert.equal((await fetch(base+'/api/leads',{method:'POST',headers:{'X-Lead-Desk':'1',Origin:origin},body:'x'.repeat(2000001)})).status,413);
  for(let i=0;i<5;i++)assert.equal((await fetch(base+'/api/ai/test',{method:'POST',headers:{'X-Lead-Desk':'1',Origin:origin}})).status,200);
  assert.equal((await fetch(base+'/api/ai/test',{method:'POST',headers:{'X-Lead-Desk':'1',Origin:origin}})).status,429);
 }finally{gateway.close();upstream.close();gateway.closeAllConnections();upstream.closeAllConnections();}
});
