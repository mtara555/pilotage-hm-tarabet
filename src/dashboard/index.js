import { isTaskDone } from '../tasks/index.js';
import { isDirecteur } from '../auth/index.js';

export function getRoleStats(rid, freq, getAllTasks) {
  const tasks=getAllTasks(rid).filter(t=>freq==='ALL'||t.freq===freq);
  const done=tasks.filter(t=>isTaskDone(rid,t.id,t.freq)).length;
  return {done, total:tasks.length, pct:tasks.length?Math.round(done/tasks.length*100):0};
}

export function getSecteurStats(secteur, freq, getAllRoles, getAllTasks) {
  const roles=getAllRoles().filter(r=>r.secteur===secteur);
  let done=0, total=0;
  roles.forEach(r=>{const s=getRoleStats(r.id,freq,getAllTasks);done+=s.done;total+=s.total;});
  return {done, total, pct:total?Math.round(done/total*100):0};
}

export function getGlobalStats(freq, getAllRoles, getAllTasks) {
  let done=0, total=0;
  getAllRoles().forEach(r=>{const s=getRoleStats(r.id,freq,getAllTasks);done+=s.done;total+=s.total;});
  return {done, total, pct:total?Math.round(done/total*100):0};
}

export function renderDashboard(dashPeriod, getAllRoles, getAllTasks, companyData) {
  const freq=dashPeriod||'Q';
  const gs=getGlobalStats(freq, getAllRoles, getAllTasks);
  const pc=gs.pct>=80?'#27ae60':gs.pct>=50?'#f39c12':'#e74c3c';
  const summaryEl=document.getElementById('dash-summary');
  if(summaryEl) {
    summaryEl.innerHTML=`
      <div class="sum-card" style="border-color:${pc}">
        <div class="sc-val" style="color:${pc}">${gs.pct}%</div>
        <div class="sc-label">Score Global</div>
        <div class="sc-sub" style="color:${pc}">${gs.done}/${gs.total} tâches</div>
      </div>
      ${['Commercial','Services','Permanence'].map(sect=>{
        const ss=getSecteurStats(sect,freq,getAllRoles,getAllTasks);
        const spc=ss.pct>=80?'#27ae60':ss.pct>=50?'#f39c12':'#e74c3c';
        return `<div class="sum-card" style="border-color:${spc}">
          <div class="sc-val" style="color:${spc}">${ss.pct}%</div>
          <div class="sc-label">${sect}</div>
          <div class="sc-sub" style="color:${spc}">${ss.done}/${ss.total}</div>
        </div>`;
      }).join('')}`;
  }
  const secteursEl=document.getElementById('dash-secteurs');
  if(!secteursEl) return;
  const secteurs=[...new Set(getAllRoles().map(r=>r.secteur))];
  secteursEl.innerHTML=secteurs.map(sect=>{
    const roles=getAllRoles().filter(r=>r.secteur===sect);
    const ss=getSecteurStats(sect,freq,getAllRoles,getAllTasks);
    const spc=ss.pct>=80?'#27ae60':ss.pct>=50?'#f39c12':'#e74c3c';
    return `<div class="secteur-block">
      <div class="secteur-head">
        <span class="sh-icon">${roles[0]?.icon||'📋'}</span>
        <span class="sh-name">${sect}</span>
        <span class="sh-pct" style="color:${spc}">${ss.pct}%</span>
      </div>
      <div class="roles-grid">
        ${roles.map(r=>{
          const rs=getRoleStats(r.id,freq,getAllTasks);
          const rc=rs.pct>=80?'#27ae60':rs.pct>=50?'#f39c12':'#e74c3c';
          return `<div class="role-card" style="border-left-color:${r.color}">
            <div class="rc-top">
              <span class="rc-icon">${r.icon}</span>
              <span class="rc-name">${r.label}</span>
              <span class="rc-pct" style="color:${rc}">${rs.pct}%</span>
            </div>
            <div class="rc-bar-wrap"><div class="rc-bar" style="width:${rs.pct}%;background:${rc}"></div></div>
            <div class="rc-count">${rs.done}/${rs.total} tâches</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }).join('');
}
