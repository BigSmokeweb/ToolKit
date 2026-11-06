import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {collectPeople,peopleCsv} from './people.mjs';
const require=createRequire(new URL('../client/package.json',import.meta.url));
const {parseHTML}=require('linkedom');
const card=(slug,name,title,city,extra='')=>`<li class="reusable-search__result-container"><div class="entity-result"><a href="/in/${slug}/"><img alt="photo"></a><div class="entity-result__title-text"><a href="https://www.linkedin.com/in/${slug}/?trk=search"><span aria-hidden="true">${name}</span><span class="visually-hidden">View ${name}'s profile</span></a> · 2nd</div><div class="entity-result__primary-subtitle">${title}</div><div class="entity-result__secondary-subtitle">${city}</div>${extra}<button>Connect</button></div></li>`;
function page(html,path='/search/results/people/') {
 const {document}=parseHTML(`<html><body><nav>${card('nav-person','Not A Result','Navigation','Delhi')}</nav><main><div class="search-results-container"><ul>${html}</ul></div></main></body></html>`);
 globalThis.document=document;globalThis.location=new URL('https://www.linkedin.com'+path);
 globalThis.getComputedStyle=node=>({display:node.style.display||'block',visibility:node.style.visibility||'visible'});
 const sample=document.querySelector('main');const proto=Object.getPrototypeOf(sample);
 proto.getClientRects=function(){return this.hasAttribute('data-unrendered')?[]:[{top:0,left:0,width:800,height:180}];};
 return document;
}
test('extracts multiple result cards, canonicalizes profile links and ignores navigation/mutual names',()=>{
 page(card('asha','Asha Test','Software Engineer | Web Developer','Mumbai, India','<p>Past: Website Developer at Old Company</p><a href="/in/mutual/">Mutual Person</a>')+card('ben','Ben Demo','Website Developer','Bengaluru, India'));
 const result=collectPeople();assert.equal(result.people.length,2);assert.equal(result.people[0].name,'Asha Test');assert.equal(result.people[0].title,'Software Engineer | Web Developer');assert.equal(result.people[0].city,'Mumbai, India');assert.equal(result.people[0].company,'');assert.equal(result.people[0].linkedInUrl,'https://www.linkedin.com/in/asha');assert.match(result.people[0].sourceText,/Old Company/);assert.equal(result.sourceUrl,'https://www.linkedin.com/search/results/people/');
});
test('skips hidden cards, anonymous members and duplicate result links',()=>{
 page(card('same','Asha Test','Developer','Mumbai')+card('same','Asha Test','Developer','Mumbai')+card('anon','LinkedIn Member','Developer','Mumbai')+'<div style="display:none">'+card('hidden','Hidden Person','CEO','Delhi')+'</div>');
 // Browser computed style reports hidden ancestors. Mirror that behavior for the fixture DOM.
 globalThis.getComputedStyle=node=>({display:node.closest('[style="display:none"]')?'none':'block',visibility:'visible'});
 assert.equal(collectPeople().people.length,1);
});
test('preserves explicit current-company text and never uses a past-company snippet as current employer',()=>{
 page(card('asha','Asha Test','Developer','Mumbai','<div data-field="current-company">Current Company</div>')+card('ben','Ben Demo','Developer','Delhi','<p>Past: Developer at Former Company</p>'));
 const {people}=collectPeople();assert.equal(people[0].company,'Current Company');assert.equal(people[1].company,'');
});
test('does not capture private messages, feed, jobs or a different site',()=>{
 page('','/messaging/');assert.throws(()=>collectPeople(),/People search/);globalThis.location=new URL('https://example.com/search/results/people/');assert.throws(()=>collectPeople(),/People search/);
});
test('supports newer whole-card links without collecting mutual connections as results',()=>{
 const document=page('<li><a href="/in/new-layout"><div><a href="/in/new-layout">New Layout</a><p>• 2nd</p><p>Website Developer</p><p>Mumbai, Maharashtra, India</p><p>Current: Website Developer at Current Company</p><a href="/in/mutual">Mutual Name</a></div></a></li>');
 const card=document.querySelector('main li');Object.defineProperty(card,'innerText',{value:'New Layout\n• 2nd\nWebsite Developer\nMumbai, Maharashtra, India\nConnect\nCurrent: Website Developer at Current Company\nMutual Name is a mutual connection'});
 const {people}=collectPeople();assert.equal(people.length,1);assert.equal(people[0].name,'New Layout');assert.equal(people[0].title,'Website Developer');assert.equal(people[0].city,'Mumbai, Maharashtra, India');assert.equal(people[0].company,'Current Company');
});
test('separates modern ARIA result cards even when Connect is a link instead of a button',()=>{
 page('<div role="list"><div role="listitem"><a href="/in/asha"><a href="/in/asha">Asha Test</a><p>Developer</p><p>Mumbai, India</p><a href="/preload/search-custom-invite/">Connect</a><a href="/in/mutual">Mutual Person</a></a></div><div role="listitem"><a href="/in/ben"><a href="/in/ben">Ben Demo</a><p>Designer</p><p>Pune, India</p><a href="/preload/search-custom-invite/">Connect</a></a></div></div>');
 const {people}=collectPeople();assert.deepEqual(people.map(p=>p.name),['Asha Test','Ben Demo']);assert.equal(people[0].linkedInUrl,'https://www.linkedin.com/in/asha');
});
test('supports missing card classes through rendered list items and keeps unknown fields blank',()=>{
 page('<li><a href="/in/plain"><span aria-hidden="true">Plain Demo</span></a><p>Visible headline with unknown layout</p><button>Connect</button></li>');const [row]=collectPeople().people;assert.equal(row.name,'Plain Demo');assert.equal(row.title,'Visible headline with unknown layout');assert.equal(row.company,'');assert.equal(row.city,'');assert.match(row.sourceText,/Visible headline/);
});
test('bounds a single-page batch to 100 without opening more pages',()=>{
 page(Array.from({length:105},(_,i)=>card('person-'+i,'Person '+i,'Developer','Mumbai')).join(''));assert.equal(collectPeople().people.length,100);
});
test('CSV preserves Unicode and multiline facts, escapes quotes and neutralizes spreadsheet formulas',()=>{
 const csv=peopleCsv([{name:'=BAD()',title:'Developer, designer',company:'Example "Test"',city:'मुंबई',linkedInUrl:'https://www.linkedin.com/in/demo',sourceText:'Name\nHeadline'}]);assert.ok(csv.startsWith('\uFEFF'));assert.match(csv,/'=BAD/);assert.match(csv,/"Developer, designer"/);assert.match(csv,/"Example ""Test"""/);assert.match(csv,/मुंबई/);assert.match(csv,/Name\nHeadline/);
});
test('hover controls send only explicitly clicked rows and Add all re-reads current results',async()=>{
 const document=page(card('asha','Asha Test','Developer','Mumbai'));const messages=[];
 globalThis.chrome={runtime:{sendMessage:async m=>{messages.push(m);return {ok:true};}}};globalThis.innerWidth=1400;
 Object.getPrototypeOf(document.querySelector('main')).getBoundingClientRect=()=>({top:100,right:1000});
 assert.equal(collectPeople({controls:true}).count,1);assert.equal(messages.length,0);
 const host=document.getElementById('lead-desk-people-tools');document.querySelector('main ul').insertAdjacentHTML('beforeend',card('ben','Ben Demo','Developer','Pune'));
 host.shadowRoot.querySelector('#all').click();await new Promise(r=>setTimeout(r,0));assert.equal(messages.length,1);assert.equal(messages[0].payload.people.length,2);
 collectPeople({controls:true});assert.equal(document.querySelectorAll('#lead-desk-people-tools').length,1);
 const next=document.getElementById('lead-desk-people-tools');next.shadowRoot.querySelector('.close').click();assert.equal(document.getElementById('lead-desk-people-tools'),null);
});
