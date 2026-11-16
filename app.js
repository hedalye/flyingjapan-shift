const $=id=>document.getElementById(id);
const slots=['오픈1','오픈2','마감'];
const weekday=['일','월','화','수','목','금','토'];
let activeMonth='';
let months=[];
let days=[];
function buildDays(month){const [y,m]=month.split('-').map(Number);return Array.from({length:new Date(Date.UTC(y,m,0)).getUTCDate()},(_,i)=>{const day=i+1,w=new Date(Date.UTC(y,m-1,day)).getUTCDay();return {day,label:`${m}/${day} (${weekday[w]})`,weekend:w===0||w===6}})}
function monthLabel(month){const [y,m]=month.split('-');return `${y}년 ${Number(m)}월`}
function closed(){return Date.now()>=new Date(data.deadline).getTime()}
function deadlineLocal(iso){const d=new Date(iso);return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(d).replace(' ','T')}
function deadlineText(iso){return new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Tokyo',dateStyle:'medium',timeStyle:'short'}).format(new Date(iso))}
let token=sessionStorage.getItem('shiftToken')||'';
let data=null;
let selections=new Set();
function k(day,slot){return `${day}:${slot}`}
function txt(s){return String(s??'')}
function safe(s){return txt(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function msg(id,text,ok=false){$(id).textContent=text;$(id).classList.toggle('ok',ok)}
function configured(){const c=window.SHIFT_CONFIG||{};return c.url?.startsWith('https://')&&c.anonKey&&!c.anonKey.startsWith('PASTE_')}
async function rpc(fn,params={}){
 const c=window.SHIFT_CONFIG;
 if(!configured())throw Error('사이트 데이터베이스 연결이 아직 설정되지 않았습니다. 관리자에게 문의해 주세요.');
 const resp=await fetch(`${c.url.replace(/\/$/,'')}/rest/v1/rpc/${fn}`,{method:'POST',headers:{'Content-Type':'application/json','apikey':c.anonKey,'Authorization':`Bearer ${c.anonKey}`},body:JSON.stringify(params)});
 const output=await resp.json().catch(()=>null);
 if(!resp.ok)throw Error(output?.message||`서버 오류 (${resp.status})`);
 return output;
}
function showLogin(){data=null;token='';sessionStorage.removeItem('shiftToken');$('app').hidden=true;$('login').hidden=false}
async function load(){months=await rpc('shift_month_list',{p_token:token});if(!months.length){throw Error('공개된 신청 월이 없습니다. 관리자에게 문의해 주세요.')}if(!months.some(x=>x.month===activeMonth))activeMonth=months[0].month;days=buildDays(activeMonth);data=await rpc('shift_month_view',{p_token:token,p_month:activeMonth});const monthSelector=$('monthSelect');monthSelector.innerHTML=months.map(x=>`<option value="${x.month}">${monthLabel(x.month)}${x.is_public?'':' · 비공개'}</option>`).join('');monthSelector.value=activeMonth;$('login').hidden=true;$('app').hidden=false;$('who').textContent=data.name;$('heading').textContent=data.admin?'시프트 관리 대시보드':'근무 가능 시간 신청';$('intro').textContent=data.admin?'직원 신청 내역을 확인하고 각 시간대별 담당자를 확정하세요.':'가능한 시간대를 중복으로 선택한 후 저장해 주세요.';$('staffView').hidden=data.admin;$('adminView').hidden=!data.admin;const expired=closed();$('deadlineBar').textContent=(data.is_public?'공개':'비공개')+' · '+(expired?'신청·수정 마감':'신청·수정 가능')+' · 제출 기한: '+deadlineText(data.deadline)+' (일본 시간)';$('deadlineBar').classList.toggle('closed',expired);if(data.admin){$('adminMonth').value=activeMonth;$('monthPublic').value=String(data.is_public);$('monthDeadline').value=deadlineLocal(data.deadline);renderAdmin()}else renderStaff();}
let selectedDay=1;
function renderStaff(){
 selections=new Set(data.availability.map(x=>k(x.day,x.slot)));
 const pref=data.preferences[0]||{};
 $('weekly').value=pref.weekly||'협의 가능'; $('notes').value=pref.notes||'';
 const expired=closed()||!data.is_public;
 $('deadlineMetric').textContent=deadlineText(data.deadline);
 $('save').disabled=expired; $('weekly').disabled=expired; $('notes').disabled=expired;
 if(!days.some(d=>d.day===selectedDay))selectedDay=1;
 renderStaffCalendar(); updateCounts();
 const confirmed=data.confirmed;
 $('myConfirmed').innerHTML=confirmed.length?confirmed.map(x=>`<span>${Number(activeMonth.split('-')[1])}/${x.day} · ${safe(x.slot)}</span>`).join(''):'확정된 시프트가 없습니다.';
}
function renderStaffCalendar(){
 const first=new Date(Number(activeMonth.slice(0,4)),Number(activeMonth.slice(5))-1,1).getDay();
 const weekdays=['일','월','화','수','목','금','토'];
 const html=weekdays.map((w,i)=>`<div class="cal-weekday ${i===0?'sunday':''}">${w}</div>`).join('')+
 Array.from({length:first},()=>'<div class="cal-empty" aria-hidden="true"></div>').join('')+
 days.map(d=>{
   const active=slots.filter(s=>selections.has(k(d.day,s)));
   const dow=new Date(Number(activeMonth.slice(0,4)),Number(activeMonth.slice(5))-1,d.day).getDay();
   return `<button type="button" class="cal-day ${selectedDay===d.day?'selected':''} ${dow===0?'sunday':''}" data-day="${d.day}" aria-label="${d.label}, ${active.length?active.join(', '):'선택 없음'}" aria-pressed="${selectedDay===d.day}"><span>${d.day}</span><span class="cal-dots">${active.map(s=>`<i class="dot ${s==='오픈1'?'d1':s==='오픈2'?'d2':'d3'}"></i>`).join('')}</span></button>`
 }).join('');
 $('staffCalendar').innerHTML=html;
 $('staffCalendar').querySelectorAll('.cal-day').forEach(b=>b.addEventListener('click',()=>{selectedDay=Number(b.dataset.day);renderStaffCalendar()}));
 const chosen=slots.filter(s=>selections.has(k(selectedDay,s)));
 $('selectedDateTitle').textContent=`${Number(activeMonth.slice(5))}월 ${selectedDay}일 (${weekdays[new Date(Number(activeMonth.slice(0,4)),Number(activeMonth.slice(5))-1,selectedDay).getDay()]})`;
 const expired=closed()||!data.is_public;
 $('staffSlotButtons').innerHTML=slots.map((s,i)=>`<button type="button" class="slot-choice ${chosen.includes(s)?'picked':''}" data-slot="${s}" ${expired?'disabled':''}><span><b>${s}</b><small>${['09:00–15:00','10:00–16:00','15:00–21:00'][i]}</small></span><span class="choice-check">${chosen.includes(s)?'✓':'+'}</span></button>`).join('')+`<button type="button" class="slot-choice all-choice ${chosen.length===3?'picked':''}" data-all="true" ${expired?'disabled':''}><span><b>모두 가능</b><small>오픈1 · 오픈2 · 마감 모두 가능</small></span><span class="choice-check">${chosen.length===3?'✓':'+'}</span></button>`;
 $('staffSlotButtons').querySelectorAll('[data-slot]').forEach(b=>b.addEventListener('click',()=>{const key=k(selectedDay,b.dataset.slot);selections.has(key)?selections.delete(key):selections.add(key);renderStaffCalendar();updateCounts()}));
 $('staffSlotButtons').querySelector('[data-all]').addEventListener('click',()=>{const all=slots.every(s=>selections.has(k(selectedDay,s)));slots.forEach(s=>all?selections.delete(k(selectedDay,s)):selections.add(k(selectedDay,s)));renderStaffCalendar();updateCounts()});
 $('clearDay').disabled=expired;
}
$('clearDay').addEventListener('click',()=>{slots.forEach(s=>selections.delete(k(selectedDay,s)));renderStaffCalendar();updateCounts()});
function updateCounts(){$('countSlots').textContent=selections.size;$('countDays').textContent=new Set([...selections].map(x=>x.split(':')[0])).size}
$('save').addEventListener('click',async()=>{const btn=$('save');btn.disabled=true;msg('saveMsg','저장 중...');try{const list=[...selections].map(x=>{const [day,slot]=x.split(':');return{day:Number(day),slot}});await rpc('shift_month_save',{p_token:token,p_month:activeMonth,p_slots:list,p_weekly:$('weekly').value,p_notes:$('notes').value});msg('saveMsg','신청 내용이 저장되었습니다. 마감 전까지 다시 수정할 수 있습니다.',true);await load()}catch(e){msg('saveMsg',e.message)}finally{btn.disabled=closed()||!data.is_public}});
function mapStaff(){return Object.fromEntries(data.staff.map(x=>[x.id,x.name]))}
function renderAdmin(){const names=mapStaff();$('staffCount').textContent=data.staff.length;$('requestCount').textContent=data.availability.length;$('confirmedCount').textContent=`${data.confirmed.length} / ${days.length*3}`;$('staffTags').innerHTML=data.staff.map(x=>`<span class="tag">${safe(x.name)}</span>`).join('');const sel=$('filterStaff');const previous=sel.value;sel.innerHTML='<option value="all">전체 직원</option>'+data.staff.map(x=>`<option value="${x.id}">${safe(x.name)}</option>`).join('');sel.value=[...sel.options].some(o=>o.value===previous)?previous:'all';$('adminGrid').innerHTML=days.map(d=>`<tr class="${d.weekend?'weekend':''}"><td>${d.label}</td>${slots.map(slot=>{const eligible=data.availability.filter(a=>a.day===d.day&&a.slot===slot);const confirmed=data.confirmed.find(c=>c.day===d.day&&c.slot===slot);return `<td><select aria-label="${d.label} ${slot}" data-day="${d.day}" data-slot="${slot}"><option value="">미배정</option>${eligible.map(a=>`<option value="${a.staff_id}" ${confirmed?.staff_id===a.staff_id?'selected':''}>${safe(names[a.staff_id]||'알 수 없음')}</option>`).join('')}</select></td>`}).join('')}</tr>`).join('');$('adminGrid').querySelectorAll('select').forEach(el=>el.addEventListener('change',()=>confirmCell(el)));renderDetails();}
async function confirmCell(el){const day=Number(el.dataset.day),slot=el.dataset.slot,chosen=el.value||null;const before=data.confirmed.find(x=>x.day===day&&x.slot===slot)?.staff_id||'';el.disabled=true;msg('adminMsg','시프트 확정 중...');try{await rpc('shift_month_confirm',{p_token:token,p_month:activeMonth,p_day:day,p_slot:slot,p_staff_id:chosen});msg('adminMsg',`${Number(activeMonth.split('-')[1])}/${day} ${slot} 배정을 저장했습니다.`,true);await load()}catch(e){msg('adminMsg',e.message);el.value=before}finally{el.disabled=false}}
function renderDetails(){const filter=$('filterStaff').value;const staff=data.staff.filter(s=>filter==='all'||s.id===filter);$('staffDetails').innerHTML=staff.map(s=>{const av=data.availability.filter(x=>x.staff_id===s.id);const pref=data.preferences.find(x=>x.staff_id===s.id);const conf=data.confirmed.filter(x=>x.staff_id===s.id);const byDay=days.map(d=>{const got=av.filter(x=>x.day===d.day).map(x=>x.slot);return got.length?`${Number(activeMonth.split('-')[1])}/${d.day}: ${got.join(', ')}`:null}).filter(Boolean);return `<div class="detail"><h3>${safe(s.name)}</h3><p>근무 가능: ${av.length}개 시간대 / ${byDay.length}일</p><p>희망 일수: ${safe(pref?.weekly||'미제출')}</p><p>확정: ${conf.length}일</p><p><b>근무 가능 날짜</b><br>${byDay.length?byDay.map(safe).join('<br>'):'신청 내역 없음'}</p>${pref?.notes?`<p><b>요청사항</b><br>${safe(pref.notes)}</p>`:''}</div>`}).join('')||'<p class="muted">등록된 직원이 없습니다.</p>'}
$('filterStaff').addEventListener('change',renderDetails);
$('monthSelect').addEventListener('change',()=>{activeMonth=$('monthSelect').value;load().catch(e=>alert(e.message))});
$('adminMonth').addEventListener('change',()=>{const existing=months.find(x=>x.month===$('adminMonth').value);if(existing){$('monthPublic').value=String(existing.is_public);$('monthDeadline').value=deadlineLocal(existing.deadline)}else{$('monthPublic').value='false';$('monthDeadline').value=''}});
$('monthForm').addEventListener('submit',async e=>{e.preventDefault();msg('monthMsg','저장 중...');try{const m=$('adminMonth').value;const local=$('monthDeadline').value;if(!m||!local)throw Error('월과 마감일을 입력해 주세요.');const deadlineISO=new Date(local+':00+09:00').toISOString();await rpc('shift_month_upsert',{p_token:token,p_month:m,p_public:$('monthPublic').value==='true',p_deadline:deadlineISO});activeMonth=m;await load();msg('monthMsg',`${monthLabel(m)} 설정이 저장되었습니다.`,true)}catch(err){msg('monthMsg',err.message)}});

$('refresh').addEventListener('click',()=>load().catch(e=>msg('adminMsg',e.message)));
$('addForm').addEventListener('submit',async e=>{e.preventDefault();msg('addMsg','추가 중...');try{await rpc('shift_add_staff',{p_token:token,p_name:$('newName').value,p_pin:$('newPin').value});$('newName').value='';msg('addMsg','직원이 추가되었습니다.',true);await load()}catch(err){msg('addMsg',err.message)}});
$('exportCsv').addEventListener('click',()=>{const names=mapStaff();const rows=[['날짜','오픈1 (09:00-15:00)','오픈2 (10:00-16:00)','마감 (15:00-21:00)'],...days.map(d=>[d.label,...slots.map(s=>names[data.confirmed.find(x=>x.day===d.day&&x.slot===s)?.staff_id]||'')])];const csv='\ufeff'+rows.map(r=>r.map(v=>'"'+txt(v).replaceAll('"','""')+'"').join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`flyingjapan_${activeMonth}_confirmed_shifts.csv`;a.click();URL.revokeObjectURL(url)});
$('pinForm').addEventListener('submit',async e=>{e.preventDefault();try{await rpc('shift_change_pin',{p_token:token,p_new_pin:$('changePin').value});$('changePin').value='';msg('pinMsg','비밀번호가 변경되었습니다.',true)}catch(err){msg('pinMsg',err.message)}});
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();msg('loginMsg','로그인 중...');try{token=await rpc('shift_login',{p_name:$('username').value.trim(),p_password:$('password').value});sessionStorage.setItem('shiftToken',token);$('password').value='';msg('loginMsg','');await load()}catch(err){msg('loginMsg',err.message)}});
$('logout').addEventListener('click',showLogin);
if(token){load().catch(()=>showLogin())}else if(!configured())msg('loginMsg','사이트 데이터베이스가 아직 연결되지 않았습니다. README.md 설정 안내를 확인해 주세요.');
