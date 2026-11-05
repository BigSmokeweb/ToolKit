import {test} from 'node:test';
import assert from 'node:assert/strict';
import {capturePayload,appUrl} from './capture.mjs';
test('captures only explicit selected text and a clean source URL',()=>{assert.deepEqual(capturePayload('Jane Demo, Founder at Example Company','https://www.linkedin.com/in/jane-demo/?tracking=123'),{text:'Jane Demo, Founder at Example Company',sourceUrl:'https://www.linkedin.com/in/jane-demo/'});});
test('does not read page content when nothing is selected',()=>{assert.throws(()=>capturePayload('','https://www.linkedin.com/in/jane-demo/'),/First select/);});
test('rejects messages and unrelated pages',()=>{for(const url of ['https://www.linkedin.com/messaging/','https://www.linkedin.com/feed/','https://example.com/in/jane','https://www.linkedin.com.evil.test/in/jane'])assert.throws(()=>capturePayload('Jane Demo Founder at Example',url));});
test('restricts the destination to local configured hosts',()=>{assert.equal(appUrl('https://localhost:7443'),'https://localhost:7443');assert.throws(()=>appUrl('https://example.com'));});
test('limits source text instead of silently truncating it',()=>{assert.throws(()=>capturePayload('a'.repeat(35001),'https://www.linkedin.com/in/jane/'),/smaller/);});
test('permits only an exact HTTPS showcase origin',()=>{assert.equal(appUrl('https://sample-demo.trycloudflare.com'),'https://sample-demo.trycloudflare.com');for(const value of ['http://sample.trycloudflare.com','https://sample.trycloudflare.com.evil.test','https://sample.trycloudflare.com/path','https://sample.trycloudflare.com/','https://user@sample.trycloudflare.com'])assert.throws(()=>appUrl(value));});
