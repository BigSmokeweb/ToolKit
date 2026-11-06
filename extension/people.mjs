// This function is deliberately self-contained: Chrome serializes it into the active tab.
// It reads rendered result cards only, after a toolbar/context-menu click. No network calls.
export function collectPeople(options = {}) {
  if (location.protocol !== 'https:' || location.hostname !== 'www.linkedin.com' || location.pathname.replace(/\/$/, '') !== '/search/results/people')
    throw new Error('Open LinkedIn → People search results first.');
  const tidy = value => (value || '').replace(/\s+/g, ' ').trim();
  const visible = node => {
    if (!node || node.closest('[hidden],[aria-hidden="true"],#lead-desk-people-tools')) return false;
    const style = getComputedStyle(node);
    return style.display !== 'none' && style.visibility !== 'hidden' && node.getClientRects().length > 0;
  };
  const profile = anchor => {
    try { const u = new URL(anchor.href, location.href); return u.protocol === 'https:' && ['www.linkedin.com', 'linkedin.com'].includes(u.hostname) && !u.username && !u.password && !u.port && /^\/in\/[^/]+\/?$/.test(u.pathname) ? 'https://www.linkedin.com' + u.pathname.replace(/\/$/, '').toLowerCase() : ''; } catch { return ''; }
  };
  const main = document.querySelector('main');
  if (!main) throw new Error('The People results have not loaded yet. Wait for the list, then retry.');
  const scope = main.querySelector('.search-results-container,.search-results__list,[data-view-name="search-results"]') || main;
  const cards = new Set();
  for (const anchor of scope.querySelectorAll('a[href*="/in/"]')) {
    if (!profile(anchor) || !visible(anchor)) continue;
    let card = anchor.closest('.reusable-search__result-container,.entity-result,[data-chameleon-result-urn],[role="listitem"],li.artdeco-list__item,li');
    // The current LinkedIn layout uses ARIA list items and whole-card links,
    // with a nested name link and Connect as a link rather than a button.
    if(!card)card=anchor.querySelector('a[href*="/in/"]')?anchor:anchor.parentElement?.closest('a[href*="/in/"]');
    // A fallback for newer layouts: choose the smallest result block with an action.
    if (!card) for (let node = anchor.parentElement, i = 0; node && node !== scope && i < 7; node = node.parentElement, i++) {
      if (node.querySelector('button') && node.querySelectorAll('a[href*="/in/"]').length && tidy(node.textContent).length > 20) { card = node; break; }
    }
    if (card && visible(card)) cards.add(card);
  }
  const people = [], found = new Set(), bindings = [];
  for (const card of cards) {
    let anchor = card.querySelector('.entity-result__title-text a[href*="/in/"],a[data-view-name="search-result-lockup-title"][href*="/in/"]');
    if (!anchor || !profile(anchor)) anchor = [...card.querySelectorAll('a[href*="/in/"]')].find(a => profile(a) && !a.querySelector('a[href*="/in/"]') && tidy(a.textContent) && !/mutual connection|connections in common/i.test(a.textContent));
    if (!anchor) continue;
    const linkedInUrl = profile(anchor);
    const nameNode = [...anchor.querySelectorAll('span[aria-hidden="true"],[data-anonymize="person-name"]')].find(n=>tidy(n.textContent)) || anchor;
    let name = tidy(nameNode.textContent).split(/\s*[·•]\s*/)[0].replace(/\s+(?:1st|2nd|3rd\+?)\b.*$/i, '').replace(/\s+View .*?profile.*$/i, '').trim();
    if (/^View .+ profile$/i.test(name)) name = name.replace(/^View (.+?)(?:[’']s)? profile$/i, '$1');
    if (!name || name.length > 160 || /^(?:LinkedIn Member|LinkedIn User|Connect|Follow|Message)$/i.test(name) || found.has(linkedInUrl)) continue;
    const read = selectors => { const node = card.querySelector(selectors); return node && visible(node) ? tidy(node.textContent) : ''; };
    let title = read('.entity-result__primary-subtitle,[data-anonymize="headline"],[data-field="headline"]');
    let city = read('.entity-result__secondary-subtitle,[data-anonymize="location"],[data-field="location"]');
    // LinkedIn's newer result cards use generated classes. Their rendered lines
    // still explicitly separate name, headline and location; never parse social proof.
    const lines = (card.innerText || '').split(/\n+/).map(tidy).filter(Boolean);
    const start = lines.findIndex(line=>line===name || line.startsWith(name+' ') || line.startsWith(name+'·') || line.startsWith(name+'•'));
    const details = start < 0 ? [] : lines.slice(start+1).filter(line=>!/^([·•]?\s*(?:1st|2nd|3rd\+?)|Verified|Connect|Follow|Message)$/i.test(line));
    if(!title && details[0] && !/^(?:Past:|Current:)|mutual connection|connections in common/i.test(details[0]))title=details[0];
    if(!city && details[1] && /,|\b(?:Region|Area|India|Remote|United States|United Kingdom|Canada|Australia|Germany|Singapore)\b/i.test(details[1]) && !/^(?:Past:|Current:)|mutual connection|connections in common/i.test(details[1]))city=details[1];
    // Preserve the exact displayed text. Never derive an employer from a Past: snippet.
    let company = read('[data-anonymize="company-name"],[data-field="current-company"]');
    if(!company){const current=lines.find(line=>/^Current:/i.test(line));const match=current?.match(/^Current:\s*.+?\s+at\s+(.+)$/i);if(match && !/(?:\.\.\.|…)\s*$/.test(match[1]))company=match[1].trim();}
    if (company && /\bPast\s*:/i.test(card.textContent)) company = '';
    let sourceText = (card.innerText || card.textContent || '').trim();
    // textContent can merge block boundaries; ensure exact field facts remain represented.
    sourceText = [name, title, company, city, sourceText].filter(Boolean).join('\n').slice(0, 6000);
    const row = {name, title: title.slice(0,250), company: company.slice(0,200), city: city.slice(0,120), linkedInUrl, sourceText};
    people.push(row); found.add(linkedInUrl); bindings.push({card,row});
    if (people.length === 100) break;
  }
  const payload = {people, sourceUrl: location.origin + location.pathname};
  if (!options.controls) return payload;
  const old = document.getElementById('lead-desk-people-tools');
  if (old) { if(old.__leadDeskCleanup)old.__leadDeskCleanup();else old.remove(); }
  const host = document.createElement('div'); host.id = 'lead-desk-people-tools';
  const shadow = host.attachShadow({mode:'open'});
  shadow.innerHTML = `<style>:host{position:fixed;right:24px;bottom:28px;z-index:2147483646;font:14px system-ui;color:#183e31}section{width:300px;background:white;border:1px solid #cbdccb;border-radius:14px;padding:18px;box-shadow:0 12px 45px #0003}h3{font-size:16px;margin:0 0 10px}p{font-size:12px;line-height:1.6;margin:10px 0}button{background:#255d4c;color:white;border:0;padding:11px 14px;border-radius:7px;cursor:pointer;font:inherit}button:disabled{opacity:.5;cursor:wait}.close{float:right;background:transparent;color:#46644d;padding:0 4px}.hover{position:fixed;display:none;max-width:220px;box-shadow:0 5px 20px #0003;z-index:2}a{color:#255d4c}</style><section><button class="close" aria-label="Close capture controls">×</button><h3>Lead Desk · People capture</h3><p id="count"></p><button id="all">Add all to Lead Desk</button><p>Only displayed results on this page. No profile visits or messages. New leads stay unapproved.</p><p id="status" role="status"></p></section><button class="hover">Add this person</button>`;
  const all = shadow.querySelector('#all'), hover = shadow.querySelector('.hover'), status = shadow.querySelector('#status');
  shadow.querySelector('#count').textContent = `${people.length} identifiable people found. Hover a result to add one.`;
  all.disabled = people.length === 0;
  let selected = null;
  const listeners = [];
  const cleanup = () => { for (const [card,event,listener] of listeners) card.removeEventListener(event,listener); host.remove(); };
  host.__leadDeskCleanup = cleanup;
  shadow.querySelector('.close').addEventListener('click',cleanup);
  const send = async rows => {
    all.disabled = true; hover.disabled = true; status.textContent = 'Sending to your paired Lead Desk…';
    try {
      const response = await chrome.runtime.sendMessage({kind:'lead-desk-people-capture',payload:{people:rows,sourceUrl:payload.sourceUrl}});
      if (!response?.ok) throw new Error(response?.error || 'Could not start capture. Reload the extension and try again.');
      status.textContent = 'Capture started. The result tab shows how many were added or already present.';
    } catch(error) { status.textContent = error.message; }
    finally { all.disabled = false; hover.disabled = false; }
  };
  all.addEventListener('click',() => {
    // Re-read current cards when clicked, never follow pagination or scroll the page.
    try { send(collectPeople().people); } catch(error) { status.textContent=error.message; }
  });
  hover.addEventListener('click',() => { if(selected) send([selected]); });
  for (const {card,row} of bindings) {
    const enter = () => { const r = card.getBoundingClientRect(); selected = row; hover.textContent = `Add ${row.name.split(' ')[0]}`; hover.style.left = Math.max(8,Math.min(innerWidth-230,r.right-230))+'px'; hover.style.top = Math.max(8,r.top+8)+'px'; hover.style.display='block'; };
    const leave = event => { if(event.relatedTarget !== host) hover.style.display='none'; };
    card.addEventListener('mouseenter',enter); card.addEventListener('mouseleave',leave); listeners.push([card,'mouseenter',enter],[card,'mouseleave',leave]);
  }
  document.documentElement.append(host);
  return {count:people.length,controls:true};
}

export function peopleCsv(people) {
  const fields = [['Name','name'],['Job title','title'],['Company','company'],['City','city'],['LinkedIn URL','linkedInUrl'],['Source URL','sourceUrl'],['Notes','sourceText']];
  const cell = value => { let s=String(value||''); if(/^[=+@\-\t\r]/.test(s))s="'"+s; return '"'+s.replace(/"/g,'""')+'"'; };
  return '\uFEFF'+fields.map(([title])=>cell(title)).join(',')+'\r\n'+people.map(row=>fields.map(([,key])=>cell(row[key])).join(',')).join('\r\n');
}
