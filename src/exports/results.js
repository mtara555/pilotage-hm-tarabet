import { _sb, _sbClient, _fbConnected } from '../services/supabase.js';
import { completions, completionLog, todayKey, periodKeyForDate,
         fmtDate, fmtDateStr, getWeekDates, deadlinePeriodInfo } from '../tasks/index.js';
import { usersData } from '../auth/index.js';

let _histCompletions  = null;
let _histCompLoadedFor = '';
let _resType = 'J';

export function setResType(type) {
  _resType=type;
  ['J','C','H','Mens','T','A'].forEach(t=>{
    const btn=document.getElementById(`res-btn-${t}`);
    if(btn) btn.classList.toggle('active',t===type);
  });
  renderResults(window._getAllRoles, window._getAllTasks);
}

export async function _loadHistoricalCompletions() {
  if(!_sbClient||!_fbConnected) return null;
  try {
    const hist=await _sb.get('hm_app_data','hm_history');
    if(hist&&typeof hist==='object'&&Object.keys(hist).length>0) return hist;
    const rows=await _sb.getAll('hm_completions');
    if(!rows||!rows.length) return null;
    let merged={};
    rows.forEach(r=>{if(r.data&&typeof r.data==='object') Object.assign(merged,r.data);});
    return merged;
  } catch(e) { return null; }
}

export function isTaskDoneForDateHist(rid, tid, freq, dateStr) {
  const targetPeriod=periodKeyForDate(freq,dateStr);
  const suffix='__'+rid+'__'+tid+'__'+targetPeriod;
  if(Object.keys(completions).some(k=>k.endsWith(suffix)&&completions[k])) return true;
  if(_histCompletions) return Object.keys(_histCompletions).some(k=>k.endsWith(suffix)&&_histCompletions[k]);
  return !!completionLog.find(e=>e.roleId===rid&&e.taskId===tid&&e.period===targetPeriod);
}

export function renderResults(getAllRoles, getAllTasks) {
  const dateVal=document.getElementById('res-date')?.value;
  const content=document.getElementById('results-content');
  if(!dateVal){if(content)content.innerHTML=`<div style="text-align:center;padding:40px;color:var(--muted);">Sélectionnez une date.</div>`;return;}
  const isToday=dateVal===todayKey();
  if(isToday||!_sbClient||!_fbConnected){_buildResults(dateVal,getAllRoles,getAllTasks);return;}
  if(_histCompLoadedFor===dateVal&&_histCompletions!==null){_buildResults(dateVal,getAllRoles,getAllTasks);return;}
  if(content) content.innerHTML=`<div style="text-align:center;padding:40px;color:var(--muted);"><div style="font-size:28px;margin-bottom:12px;">⏳</div><div style="font-weight:700;">Chargement des données historiques…</div></div>`;
  _loadHistoricalCompletions().then(hist=>{
    _histCompletions=hist; _histCompLoadedFor=dateVal;
    _buildResults(dateVal,getAllRoles,getAllTasks);
  }).catch(()=>_buildResults(dateVal,getAllRoles,getAllTasks));
}

function _buildResults(dateVal, getAllRoles, getAllTasks) {
  const content=document.getElementById('results-content'); if(!content) return;
  if(_resType==='J')    content.innerHTML=buildDailyResults(dateVal,getAllRoles,getAllTasks);
  else if(_resType==='C') content.innerHTML=buildCumulResults(dateVal,getAllRoles,getAllTasks);
  else if(_resType==='H') content.innerHTML=buildWeeklyResults(dateVal,getAllRoles,getAllTasks);
  else if(_resType==='Mens') content.innerHTML=buildMonthlyResults(dateVal,getAllRoles,getAllTasks);
  else if(_resType==='T') content.innerHTML=buildQuarterlyResults(dateVal,getAllRoles,getAllTasks);
  else if(_resType==='A') content.innerHTML=buildAnnualResults(dateVal,getAllRoles,getAllTasks);
}

export function buildDailyResults(dateStr, getAllRoles, getAllTasks) {
  const dayLabel=fmtDate(new Date(dateStr+'T00:00:00'));
  let totalQ=0, doneCount=0;
  const roleStats={};
  getAllRoles().forEach(r=>{
    const rTasks=getAllTasks(r.id).filter(t=>t.freq==='Q');
    const rLogs=completionLog.filter(e=>e.roleId===r.id&&e.freq==='Q'&&e.period===dateStr);
    let rd=0; rTasks.forEach(t=>{if(isTaskDoneForDateHist(r.id,t.id,'Q',dateStr)) rd++;});
    roleStats[r.id]={tasks:rTasks,logs:rLogs,done:rd};
    totalQ+=rTasks.length; doneCount+=rd;
  });
  const pct=totalQ?Math.round(doneCount/totalQ*100):0;
  const pc=pct>=80?'#27ae60':pct>=50?'#f39c12':'#e74c3c';
  let rolesHtml='';
  getAllRoles().forEach(r=>{
    const {tasks:rTasks,logs:rLogs,done:rd}=roleStats[r.id]||{tasks:[],logs:[],done:0};
    const totalRQ=rTasks.length;
    const rPct=totalRQ?Math.round(rd/totalRQ*100):0;
    const rPc=rPct>=80?'#27ae60':rPct>=50?'#f39c12':'#e74c3c';
    const tasksDetail=rTasks.map(t=>{
      const done2=isTaskDoneForDateHist(r.id,t.id,'Q',dateStr);
      const logE=rLogs.find(e=>e.taskId===t.id);
      let horaireHtml='';
      if(t.deadline){
        const dpi=deadlinePeriodInfo(t.deadline);
        if(done2&&logE){
          const doneAt=new Date(logE.completedAt);
          const doneStr=doneAt.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
          const [dh,dm]=t.deadline.split(':').map(Number);
          const onTime=(doneAt.getHours()*60+doneAt.getMinutes())<=dh*60+dm;
          const who=usersData.find(u=>u.id===logE.userId)?.name||'';
          horaireHtml=`<span style="font-size:10px;font-weight:700;padding:1px 7px;border-radius:8px;margin-left:6px;background:${onTime?'#eafaf1':'#fdecea'};color:${onTime?'#27ae60':'#e74c3c'}">${onTime?'🟢':'🔴'} ${dpi.emoji} ${dpi.label} · ${doneStr}${who?' · '+who:''}</span>`;
        } else {
          horaireHtml=`<span style="font-size:10px;font-weight:700;padding:1px 7px;border-radius:8px;margin-left:6px;background:#fdecea;color:#e74c3c">⛔ ${dpi.emoji} ${dpi.label}</span>`;
        }
      }
      return `<div style="display:flex;align-items:center;padding:4px 8px;background:${done2?'#f0fff4':'#fff5f5'};border-radius:6px;margin:3px 0;font-size:11px;">
        <span style="margin-right:6px;font-size:13px;">${done2?'✅':'⬜'}</span>
        <span style="flex:1;color:${done2?'#1a6b3c':'#555'};text-decoration:${done2?'line-through':'none'}">${t.label}</span>
        ${horaireHtml}
      </div>`;
    }).join('');
    rolesHtml+=`<div class="res-role-row" style="flex-direction:column;align-items:stretch;">
      <div style="display:flex;align-items:center;gap:6px;">
        <span class="res-role-icon">${r.icon}</span>
        <span class="res-role-name">${r.label}</span>
        <div class="res-role-bar-wrap" style="flex:1"><div class="res-role-bar" style="width:${rPct}%;background:${r.color}"></div></div>
        <span class="res-role-pct" style="color:${rPc}">${rPct}%</span>
        <span class="res-role-ct">${rd}/${totalRQ}</span>
      </div>
      ${tasksDetail?`<div style="margin:6px 0 4px 28px;">${tasksDetail}</div>`:''}
    </div>`;
  });
  return `<div class="res-card"><h3>📅 Journalier — ${dayLabel}</h3>
    <div class="res-stat-grid">
      <div class="res-stat"><div class="res-stat-val" style="color:${pc}">${pct}%</div><div class="res-stat-lbl">Taux complétion</div></div>
      <div class="res-stat"><div class="res-stat-val" style="color:#2980b9">${doneCount}</div><div class="res-stat-lbl">Réalisées</div></div>
      <div class="res-stat"><div class="res-stat-val" style="color:#e74c3c">${totalQ-doneCount}</div><div class="res-stat-lbl">Non réalisées</div></div>
      <div class="res-stat"><div class="res-stat-val">${totalQ}</div><div class="res-stat-lbl">Total Q</div></div>
    </div>
    <div style="font-size:12px;font-weight:800;color:var(--muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;">Par fonction</div>
    ${rolesHtml}</div>`;
}
export function buildCumulResults(dateStr, getAllRoles, getAllTasks) {
  const weekDates=getWeekDates(dateStr); const today=todayKey();
  let totalQ=0;
  getAllRoles().forEach(r=>{totalQ+=getAllTasks(r.id).filter(t=>t.freq==='Q').length;});
  const days=['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
  let daysHtml='', cumDone=0;
  weekDates.forEach((d,i)=>{
    const isFuture=d>today||d>dateStr; let done=0;
    if(!isFuture){getAllRoles().forEach(r=>{getAllTasks(r.id).filter(t=>t.freq==='Q').forEach(t=>{if(isTaskDoneForDateHist(r.id,t.id,'Q',d)) done++;});});}
    const pct=totalQ?Math.round(done/totalQ*100):0;
    const pc=pct>=80?'#27ae60':pct>=50?'#f39c12':'#e74c3c';
    if(!isFuture) cumDone+=done;
    daysHtml+=`<div class="res-day-row" style="${isFuture?'opacity:.4':''}">
      <span class="res-day-label">${days[i]} ${fmtDateStr(d)}${d===today?' 📍':''}</span>
      <div class="res-day-bar-wrap"><div class="res-day-bar" style="width:${isFuture?0:pct}%;background:${pc}"></div></div>
      <span class="res-day-pct" style="color:${isFuture?'#bbb':pc}">${isFuture?'—':pct+'%'}</span>
    </div>`;
  });
  const activeDates=weekDates.filter(d=>d<=today&&d<=dateStr);
  const totalPossible=totalQ*activeDates.length;
  const gPct=totalPossible?Math.round(cumDone/totalPossible*100):0;
  const gPc=gPct>=80?'#27ae60':gPct>=50?'#f39c12':'#e74c3c';
  return `<div class="res-card"><h3>📈 Cumulé Semaine — ${fmtDateStr(weekDates[0])} → ${fmtDateStr(weekDates[6])}</h3>
    <div class="res-stat-grid">
      <div class="res-stat"><div class="res-stat-val" style="color:${gPc}">${gPct}%</div><div class="res-stat-lbl">Taux cumulé</div></div>
      <div class="res-stat"><div class="res-stat-val">${cumDone}</div><div class="res-stat-lbl">Tâches réalisées</div></div>
      <div class="res-stat"><div class="res-stat-val">${activeDates.length}</div><div class="res-stat-lbl">Jours actifs</div></div>
    </div>${daysHtml}</div>`;
}

export function buildWeeklyResults(dateStr, getAllRoles, getAllTasks) {
  const weekDates=getWeekDates(dateStr); let html='';
  getAllRoles().forEach(r=>{
    const tasks=getAllTasks(r.id).filter(t=>t.freq==='H'); if(!tasks.length) return;
    let done=0; tasks.forEach(t=>{if(isTaskDoneForDateHist(r.id,t.id,'H',dateStr)) done++;});
    const pct=tasks.length?Math.round(done/tasks.length*100):0;
    const pc=pct>=80?'#27ae60':pct>=50?'#f39c12':'#e74c3c';
    html+=`<div class="res-role-row">
      <span class="res-role-icon">${r.icon}</span>
      <span class="res-role-name">${r.label}</span>
      <div class="res-role-bar-wrap"><div class="res-role-bar" style="width:${pct}%;background:${r.color}"></div></div>
      <span class="res-role-pct" style="color:${pc}">${pct}%</span>
      <span class="res-role-ct">${done}/${tasks.length}</span>
    </div>`;
  });
  return `<div class="res-card"><h3>📆 Hebdomadaire — ${fmtDateStr(weekDates[0])} → ${fmtDateStr(weekDates[6])}</h3>
    ${html||'<div style="text-align:center;padding:30px;color:var(--muted);">Aucune tâche hebdomadaire.</div>'}</div>`;
}

export function buildMonthlyResults(dateStr, getAllRoles, getAllTasks) {
  const month=dateStr.slice(0,7); let html='';
  getAllRoles().forEach(r=>{
    const tasks=getAllTasks(r.id).filter(t=>t.freq==='M'); if(!tasks.length) return;
    let done=0; tasks.forEach(t=>{if(isTaskDoneForDateHist(r.id,t.id,'M',dateStr)) done++;});
    const pct=tasks.length?Math.round(done/tasks.length*100):0;
    const pc=pct>=80?'#27ae60':pct>=50?'#f39c12':'#e74c3c';
    html+=`<div class="res-role-row">
      <span class="res-role-icon">${r.icon}</span>
      <span class="res-role-name">${r.label}</span>
      <div class="res-role-bar-wrap"><div class="res-role-bar" style="width:${pct}%;background:${r.color}"></div></div>
      <span class="res-role-pct" style="color:${pc}">${pct}%</span>
      <span class="res-role-ct">${done}/${tasks.length}</span>
    </div>`;
  });
  return `<div class="res-card"><h3>🗓️ Mensuel — ${month}</h3>
    ${html||'<div style="text-align:center;padding:30px;color:var(--muted);">Aucune tâche mensuelle.</div>'}</div>`;
}

export function buildQuarterlyResults(dateStr, getAllRoles, getAllTasks) {
  const d=new Date(dateStr+'T00:00:00');
  const q=Math.ceil((d.getMonth()+1)/3);
  const label=`T${q} ${d.getFullYear()}`; let html='';
  getAllRoles().forEach(r=>{
    const tasks=getAllTasks(r.id).filter(t=>t.freq==='T'); if(!tasks.length) return;
    let done=0; tasks.forEach(t=>{if(isTaskDoneForDateHist(r.id,t.id,'T',dateStr)) done++;});
    const pct=tasks.length?Math.round(done/tasks.length*100):0;
    const pc=pct>=80?'#27ae60':pct>=50?'#f39c12':'#e74c3c';
    html+=`<div class="res-role-row">
      <span class="res-role-icon">${r.icon}</span>
      <span class="res-role-name">${r.label}</span>
      <div class="res-role-bar-wrap"><div class="res-role-bar" style="width:${pct}%;background:${r.color}"></div></div>
      <span class="res-role-pct" style="color:${pc}">${pct}%</span>
      <span class="res-role-ct">${done}/${tasks.length}</span>
    </div>`;
  });
  return `<div class="res-card"><h3>📊 Trimestriel — ${label}</h3>
    ${html||'<div style="text-align:center;padding:30px;color:var(--muted);">Aucune tâche trimestrielle.</div>'}</div>`;
}

export function buildAnnualResults(dateStr, getAllRoles, getAllTasks) {
  const y=dateStr.slice(0,4); let html='';
  getAllRoles().forEach(r=>{
    const tasks=getAllTasks(r.id).filter(t=>t.freq==='A'); if(!tasks.length) return;
    let done=0; tasks.forEach(t=>{if(isTaskDoneForDateHist(r.id,t.id,'A',dateStr)) done++;});
    const pct=tasks.length?Math.round(done/tasks.length*100):0;
    const pc=pct>=80?'#27ae60':pct>=50?'#f39c12':'#e74c3c';
    html+=`<div class="res-role-row">
      <span class="res-role-icon">${r.icon}</span>
      <span class="res-role-name">${r.label}</span>
      <div class="res-role-bar-wrap"><div class="res-role-bar" style="width:${pct}%;background:${r.color}"></div></div>
      <span class="res-role-pct" style="color:${pc}">${pct}%</span>
      <span class="res-role-ct">${done}/${tasks.length}</span>
    </div>`;
  });
  return `<div class="res-card"><h3>📅 Annuel — ${y}</h3>
    ${html||'<div style="text-align:center;padding:30px;color:var(--muted);">Aucune tâche annuelle.</div>'}</div>`;
}
