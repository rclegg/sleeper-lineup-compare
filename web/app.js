// Sleeper Lineup Compare: scores two lineups with a Sleeper league's own scoring rules.
// Data comes from the public Sleeper API; lineups, prefs and the player cache live in localStorage.

// --- State and helpers ---
const API='https://api.sleeper.app/v1';
const POS=['QB','RB','WR','TE','K','DEF'];
let players={}, index=[], scoring={}, stats=null;
let teams=load('teams',[{name:'Team A',ids:[]},{name:'Team B',ids:[]}]);
const $=id=>document.getElementById(id);

function load(k,d){try{const v=localStorage.getItem('lc_'+k);return v?JSON.parse(v):d}catch(e){return d}}
function save(k,v){try{localStorage.setItem('lc_'+k,JSON.stringify(v))}catch(e){}}
function status(t,err){const s=$('status');s.textContent=t;s.className='status'+(err?' err':'')}
async function get(path){const r=await fetch(API+path);if(!r.ok)throw new Error('Sleeper returned '+r.status);return r.json()}

// --- Player list (cached for a day) ---
async function loadPlayers(){
  const cache=load('players_meta',null);
  if(cache&&Date.now()-cache.t<864e5){try{const raw=localStorage.getItem('lc_players');if(raw)return JSON.parse(raw)}catch(e){}}
  const p=await get('/players/nfl');
  const slim={};
  for(const id in p){const x=p[id];const pos=(x.fantasy_positions||[])[0]||x.position;
    if(!POS.includes(pos))continue;
    if(pos!=='DEF'&&x.status!=='Active'&&x.status!=='Injured Reserve'&&x.status!=='Questionable'&&x.status!=='Out'&&x.status!=='Doubtful'&&!x.team)continue;
    if(pos!=='DEF'&&!x.team)continue;
    slim[id]={n:pos==='DEF'?(x.first_name+' '+x.last_name):(x.full_name||(x.first_name+' '+x.last_name)),p:pos,t:x.team||''}}
  save('players_meta',{t:Date.now()});save('players',slim);
  return slim}

// --- Scoring ---
function pts(s){if(!s)return 0;let t=0;for(const k in scoring){if(s[k]!=null)t+=s[k]*scoring[k]}return Math.round(t*100)/100}
function playerPts(id){
  if(!stats)return null;
  if(Array.isArray(stats)){let t=0;for(const w of stats)t+=pts(w[id]);return Math.round(t*100)/100}
  return pts(stats[id])}

// --- Rendering and lineup editing ---
function render(){
  const cols=$('cols');cols.innerHTML='';
  const totals=teams.map(t=>t.ids.reduce((a,id)=>a+(playerPts(id)||0),0));
  teams.forEach((t,i)=>{
    const c=document.createElement('div');c.className='team';c.style.setProperty('--c',i?'var(--b)':'var(--a)');
    const hi=stats&&t.ids.length&&totals[i]>totals[1-i];
    if(hi)c.classList.add('win');
    // Display order is fixed by position (then points, then name), whatever order players were added.
    const sorted=[...t.ids].sort((x,y)=>{const px=players[x]||{},py=players[y]||{};
      return (POS.indexOf(px.p)+1||99)-(POS.indexOf(py.p)+1||99)||(playerPts(y)||0)-(playerPts(x)||0)||String(px.n).localeCompare(py.n)});
    const missing=POS.filter(p=>!t.ids.some(id=>(players[id]||{}).p===p));
    const hint=t.ids.length&&missing.length?`<div class="hint">Not added yet: ${missing.join(' · ')}</div>`:'';
    const rows=sorted.map(id=>{const p=players[id]||{n:id,p:'',t:''};const v=playerPts(id);
      return `<tr><td><div class="who"><img class="av" src="${avatar(id,p)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"><span class="pos ${p.p}">${p.p}</span><span>${esc(p.n)} <small style="color:var(--mute)">${p.t}</small></span></div></td><td class="pts">${v==null?'–':v.toFixed(2)}</td><td class="x"><button data-t="${i}" data-id="${id}" aria-label="Remove">×</button></td></tr>`}).join('');
    c.innerHTML=`<h2><input value="${esc(t.name)}" data-name="${i}" aria-label="Team name"></h2>
      <div class="total">${stats?totals[i].toFixed(2):'–'}</div>
      <div class="search"><input placeholder="Add player…" data-s="${i}"><div class="results" hidden></div></div>
      ${rows?`<table>${rows}</table>${hint}`:'<div class="empty">No players yet. Search above to add.</div>'}`;
    cols.appendChild(c)});
  const v=$('verdict');
  if(stats&&teams.every(t=>t.ids.length)){const d=totals[0]-totals[1];
    v.textContent=Math.abs(d)<0.005?'Tied.':`${teams[d>0?0:1].name} leads by ${Math.abs(d).toFixed(2)}`}
  else v.textContent=''}
function avatar(id,p){return p.p==='DEF'?'https://sleepercdn.com/images/team_logos/nfl/'+String(p.t||id).toLowerCase()+'.png':'https://sleepercdn.com/content/nfl/players/thumb/'+id+'.jpg'}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}

$('cols').addEventListener('click',e=>{
  const b=e.target.closest('button[data-id]');
  if(b){const t=teams[+b.dataset.t];t.ids=t.ids.filter(x=>x!==b.dataset.id);save('teams',teams);render();return}
  const r=e.target.closest('.results div[data-id]');
  if(r){const i=+r.dataset.t;if(!teams[i].ids.includes(r.dataset.id))teams[i].ids.push(r.dataset.id);save('teams',teams);render()}});
$('cols').addEventListener('input',e=>{
  const n=e.target.dataset.name;if(n!=null){teams[+n].name=e.target.value;save('teams',teams);return}
  const si=e.target.dataset.s;if(si==null)return;
  const q=e.target.value.trim().toLowerCase();const box=e.target.nextElementSibling;
  if(q.length<2){box.hidden=true;return}
  const hits=index.filter(p=>p.l.includes(q)).slice(0,12);
  box.innerHTML=hits.map(p=>`<div data-id="${p.id}" data-t="${si}"><span>${esc(p.n)}</span><small>${p.p} ${p.t}</small></div>`).join('')||'<div>No match</div>';
  box.hidden=false});
document.addEventListener('click',e=>{if(!e.target.closest('.search'))document.querySelectorAll('.results').forEach(r=>r.hidden=true)});

// --- League lookup and scoring ---
const isLeagueId=v=>/^\d{12,}$/.test(v);
let leagueId='';
// Accepts a league ID directly, or a username and offers that user's leagues for the chosen season.
async function resolveLeague(){
  const v=$('league').value.trim(),pick=$('pick'),season=$('season').value;
  if(!v){pick.hidden=true;throw new Error('Enter your Sleeper username or a league ID first.')}
  if(isLeagueId(v)){leagueId=v;pick.hidden=true;return}
  status('Finding leagues for '+v+'…');
  const u=await get('/user/'+encodeURIComponent(v));
  if(!u||!u.user_id)throw new Error('No Sleeper user named '+v);
  const leagues=await get(`/user/${u.user_id}/leagues/nfl/${season}`);
  if(!leagues||!leagues.length)throw new Error(v+' has no leagues in '+season);
  const prev=pick.value;
  pick.innerHTML=(leagues.length>1?'<option value="">Choose a league…</option>':'')+leagues.map(l=>`<option value="${l.league_id}">${esc(l.name)}</option>`).join('');
  if(leagues.some(l=>l.league_id===prev))pick.value=prev;
  pick.hidden=false;leagueId=pick.value;
  if(!leagueId)throw new Error(`${v} has ${leagues.length} leagues. Choose one from the list.`)}
$('pick').addEventListener('change',()=>{leagueId=$('pick').value;if(leagueId)score()});
// Look up leagues as soon as the user stops typing, so the picker is ready before scoring.
let lookupTimer;
function lookupLeagues(){
  clearTimeout(lookupTimer);
  lookupTimer=setTimeout(async()=>{
    const v=$('league').value.trim();
    if(!v||isLeagueId(v)){$('pick').hidden=true;if(isLeagueId(v))leagueId=v;return}
    try{await resolveLeague();status('Choose a league, then add players and tap Score.')}
    catch(e){status(e.message)}},600)}
$('league').addEventListener('input',()=>{$('pick').hidden=true;leagueId='';lookupLeagues()});
$('league').addEventListener('keydown',e=>{if(e.key==='Enter')score()});
$('season').addEventListener('change',()=>{const v=$('league').value.trim();if(v&&!isLeagueId(v)){$('pick').value='';lookupLeagues()}});
async function score(){
  const season=$('season').value,week=$('week').value;
  save('prefs',{league:$('league').value,season,week});
  $('go').disabled=true;
  try{
    try{await resolveLeague()}catch(e){status(e.message,true);stats=null;$('go').disabled=false;render();return}
    status('Loading league scoring…');
    const lg=await get('/league/'+leagueId);
    if(!lg||!lg.scoring_settings)throw new Error('No league found for that ID');
    scoring=lg.scoring_settings;
    status('Loading stats…');
    if(week==='all'){
      const maxW=+maxWeek();const arr=await Promise.all(Array.from({length:maxW},(_,i)=>get(`/stats/nfl/regular/${season}/${i+1}`).catch(()=>({}))));
      stats=arr}
    else stats=await get(`/stats/nfl/regular/${season}/${week}`);
    status(week==='all'?`Season ${season}, all weeks`:`Season ${season}, week ${week}`);
  }catch(err){status('Could not load stats: '+err.message,true);stats=null}
  $('go').disabled=false;render()}
function maxWeek(){return window._curWeek&&$('season').value==window._curSeason?Math.max(1,window._curWeek):18}

// --- Startup, sharing and theme ---
async function init(){
  const pref=load('prefs',{});
  const shared=readShared();
  if(shared){teams=shared.t.map((t,i)=>({name:String(t.n||('Team '+'AB'[i])),ids:(Array.isArray(t.i)?t.i:[]).map(String)}));
    if(shared.s)pref.season=shared.s;if(shared.w)pref.week=shared.w;if(shared.l)pref.league=shared.l}
  $('league').value=pref.league||'';
  let cs=new Date().getFullYear(),cw=1;
  try{const st=await get('/state/nfl');cs=+st.season;cw=+st.display_week||+st.week||1;window._curSeason=String(cs);window._curWeek=cw}catch(e){}
  const sel=$('season');for(let y=cs;y>=cs-3;y--)sel.add(new Option(y,y));
  sel.value=pref.season||cs;
  const w=$('week');w.add(new Option('Season total','all'));for(let i=1;i<=18;i++)w.add(new Option('Week '+i,i));
  w.value=pref.week||Math.max(1,cw-1);
  try{players=await loadPlayers();
    index=Object.entries(players).map(([id,p])=>({id,n:p.n,p:p.p,t:p.t,l:p.n.toLowerCase()}));
    status('Ready. Add players to each team, then tap Score.')}
  catch(e){status('Could not load players: '+e.message,true)}
  render();
  if(shared&&index.length)score();else lookupLeagues()}
function shareState(){
  const d={t:teams.map(t=>({n:t.name,i:t.ids})),s:$('season').value,w:$('week').value,l:leagueId};
  return btoa(unescape(encodeURIComponent(JSON.stringify(d))))}
$('share').addEventListener('click',async()=>{
  const url=location.href.split('#')[0]+'#d='+encodeURIComponent(shareState());
  const box=$('shareurl');box.value=url;box.hidden=false;box.select();
  try{await navigator.clipboard.writeText(url);status('Link copied. Send it to your friend.')}
  catch(e){status('Copy the link below and send it to your friend.')}});
function readShared(){
  try{const m=location.hash.match(/^#d=(.+)$/);if(!m)return null;
    const d=JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1])))));
    if(!d||!Array.isArray(d.t)||d.t.length!==2)return null;return d}catch(e){return null}}
$('go').addEventListener('click',score);
const THEMES=['auto','light','dark'];
function applyTheme(t){const r=document.documentElement;if(t==='auto')r.removeAttribute('data-theme');else r.setAttribute('data-theme',t);$('theme').title='Theme: '+t+' (tap to change)'}
applyTheme(load('theme','auto'));
// Remember whether the how-it-works panel was collapsed.
$('howto').open=load('howto_open',true);
$('howto').addEventListener('toggle',()=>save('howto_open',$('howto').open));
$('theme').addEventListener('click',()=>{const t=THEMES[(THEMES.indexOf(load('theme','auto'))+1)%3];save('theme',t);applyTheme(t)});
init();
