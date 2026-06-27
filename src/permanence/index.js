import { _sb, _sbClient, _fbConnected } from '../services/supabase.js';
import { currentUser, usersData, isDirecteur, canEditRole } from '../auth/index.js';
import { todayKey } from '../tasks/index.js';

export const PERM_ROLE_IDS    = ['perm_matin','perm_soir','perm_tranche'];
export const PERM_SLOT_OF_ROLE = {
  perm_matin:'matin', perm_soir:'soir', perm_tranche:'tranche'
};

export let permanencePlanning = {};
export function setPermanencePlanning(v) { permanencePlanning = v; }

export function isPermanenceRole(rid) { return PERM_ROLE_IDS.includes(rid); }

function dateKeyMinus(days) {
  const d=new Date(); d.setDate(d.getDate()-days);
  return d.toISOString().slice(0,10);
}
function dateKeyPlus(days) {
  const d=new Date(); d.setDate(d.getDate()+days);
  return d.toISOString().slice(0,10);
}

export function getPermanenceAssignedName(roleId) {
  const slot=PERM_SLOT_OF_ROLE[roleId]; if(!slot) return null;
  const plan=permanencePlanning[todayKey()];
  const entry=plan&&plan[slot];
  if(!entry||!entry.userId) return null;
  const u=usersData.find(x=>x.id===entry.userId);
  return u?u.name:null;
}

export function getPermanenceHoraireLabel(roleId) {
  if(roleId==='perm_matin') return 'avant 12:00';
  if(roleId==='perm_soir') return 'avant 22:00';
  if(roleId==='perm_tranche'){
    const plan=permanencePlanning[todayKey()];
    const t=plan&&plan.tranche;
    if(!t||!t.heureDebut||!t.heureFin) return null;
    return `${t.heureDebut} – ${t.heureFin}`;
  }
  return null;
}

export function getPermanenceIncomingNote(roleId) {
  const today=todayKey();
  if(roleId==='perm_matin'){
    const yPlan=permanencePlanning[dateKeyMinus(1)];
    return (yPlan&&yPlan.notes&&yPlan.notes.soir)||'';
  }
  if(roleId==='perm_tranche'){
    const plan=permanencePlanning[today];
    return (plan&&plan.notes&&plan.notes.matin)||'';
  }
  if(roleId==='perm_soir'){
    const plan=permanencePlanning[today];
    if(plan&&plan.tranche&&plan.tranche.userId)
      return (plan.notes&&plan.notes.tranche)||'';
    return (plan&&plan.notes&&plan.notes.matin)||'';
  }
  return '';
}

export function getPermanenceOutgoingNote(roleId) {
  const slot=PERM_SLOT_OF_ROLE[roleId]; if(!slot) return '';
  const plan=permanencePlanning[todayKey()];
  return (plan&&plan.notes&&plan.notes[slot])||'';
}

export function savePermanenceOutgoingNote(roleId) {
  const slot=PERM_SLOT_OF_ROLE[roleId]; if(!slot) return;
  const ta=document.getElementById('perm-note-out'); if(!ta) return;
  const today=todayKey();
  if(!permanencePlanning[today]) permanencePlanning[today]={};
  if(!permanencePlanning[today].notes) permanencePlanning[today].notes={};
  permanencePlanning[today].notes[slot]=ta.value.trim();
  savePermanencePlanning();
}

export function savePermanencePlanning() {
  try{localStorage.setItem('hm_permanence_planning',JSON.stringify(permanencePlanning));}catch(e){}
  if(_sbClient&&_fbConnected)
    _sb.set('hm_app_data','hm_permanence_planning',permanencePlanning).catch(()=>{});
}
export function buildPermanenceBannerHtml(roleId) {
  const slotLabel=roleId==='perm_matin'?'Matin':roleId==='perm_soir'?'Soir':'Tranche';
  const respName=getPermanenceAssignedName(roleId);
  const horaire=getPermanenceHoraireLabel(roleId);
  const incoming=getPermanenceIncomingNote(roleId);
  const outgoing=getPermanenceOutgoingNote(roleId);
  const canWrite=canEditRole(roleId)||isDirecteur();
  return `
  <div style="background:#fff;border-radius:var(--radius);box-shadow:var(--shadow);padding:14px 16px;margin-bottom:14px;">
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:${incoming||canWrite?'10px':'0'};">
      <span style="font-size:11px;font-weight:800;padding:4px 10px;border-radius:8px;background:#eef0f5;color:#1a1f2e;">
        👤 Responsable ${slotLabel} : ${respName||'Non planifié'}
      </span>
      ${horaire?`<span style="font-size:11px;font-weight:800;padding:4px 10px;border-radius:8px;background:#fef9f0;color:#e67e22;">⏰ ${horaire}</span>`:''}
    </div>
    ${incoming?`<div style="font-size:12px;background:#eaf4fb;border-radius:8px;padding:8px 10px;margin-bottom:8px;">
      <strong>📥 Note du créneau précédent :</strong><br>${incoming.replace(/</g,'&lt;')}</div>`:''}
    ${canWrite?`<div>
      <label style="font-size:11px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px;">
        📤 Note de passation pour le créneau suivant
      </label>
      <textarea id="perm-note-out" rows="2"
        style="width:100%;box-sizing:border-box;border-radius:8px;border:1.5px solid var(--border);padding:8px 10px;font-size:12px;font-family:inherit;resize:vertical;"
        placeholder="RAS, ou détails à transmettre...">${outgoing.replace(/</g,'&lt;')}</textarea>
      <button class="btn-secondary" style="margin-top:6px;font-size:11px;padding:6px 12px;"
        onclick="window.savePermanenceOutgoingNote('${roleId}')">💾 Enregistrer la note</button>
    </div>`:''}
  </div>`;
}

export function renderPermanenceBanner(currentRoleId, viewMode) {
  const el=document.getElementById('permanence-banner'); if(!el) return;
  if(isPermanenceRole(currentRoleId)&&viewMode==='role'){
    el.innerHTML=buildPermanenceBannerHtml(currentRoleId);
    el.style.display='block';
  } else {
    el.innerHTML=''; el.style.display='none';
  }
}

export function permanenceTodayBannerHtml(getRoleStats) {
  const visible=isDirecteur()
    ?PERM_ROLE_IDS
    :PERM_ROLE_IDS.filter(id=>canEditRole(id));
  if(!visible.length) return '';
  const chips=visible.map(rid=>{
    const r=window._getRole&&window._getRole(rid); if(!r) return '';
    const name=getPermanenceAssignedName(rid);
    const horaire=getPermanenceHoraireLabel(rid);
    const s=getRoleStats(rid,'Q');
    const pc=s.total===0?'#bbb':s.pct===100?'#27ae60':s.pct>=50?'#f39c12':'#e74c3c';
    return `<div style="flex:1;min-width:150px;background:#fff;border-radius:10px;box-shadow:var(--shadow);
      padding:10px 12px;border-left:4px solid ${r.color};cursor:pointer;"
      onclick="window._goToPermanenceRole('${rid}')">
      <div style="font-size:11px;font-weight:800;color:${r.color};">${r.icon} ${r.label}</div>
      <div style="font-size:12px;font-weight:700;margin-top:3px;">${name||'<span style="color:#e74c3c">Non planifié</span>'}</div>
      <div style="font-size:10px;color:var(--muted);margin-top:2px;">${horaire||'—'} · <span style="color:${pc};font-weight:800;">${s.done}/${s.total}</span></div>
    </div>`;
  }).join('');
  return `<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:18px;">${chips}</div>`;
}

export function renderPermanencePlanning() {
  const el=document.getElementById('permanence-planning-table'); if(!el) return;
  const users=usersData.filter(u=>u.active);
  const userOptions=(selected)=>
    `<option value="">— Non assigné —</option>`+
    users.map(u=>`<option value="${u.id}"${u.id===selected?' selected':''}>${u.name}</option>`).join('');
  const jours=[0,1,2,3,4,5,6].map(i=>dateKeyPlus(i));
  const joursNomMap={0:'Dim',1:'Lun',2:'Mar',3:'Mer',4:'Jeu',5:'Ven',6:'Sam'};
  el.innerHTML=`<div style="overflow-x:auto;">
  <table style="width:100%;border-collapse:collapse;min-width:640px;font-size:12px;">
    <thead><tr style="text-align:left;border-bottom:2px solid var(--border);">
      <th style="padding:6px 8px;">Jour</th>
      <th style="padding:6px 8px;">🌅 Matin</th>
      <th style="padding:6px 8px;">🌙 Soir</th>
      <th style="padding:6px 8px;">🔄 Tranche</th>
    </tr></thead><tbody>
    ${jours.map((d,i)=>{
      const dObj=new Date(d+'T12:00:00');
      const label=`${joursNomMap[dObj.getDay()]} ${dObj.getDate()}/${dObj.getMonth()+1}${i===0?' <span style="color:var(--accent);font-weight:800;">(Aujourd\'hui)</span>':''}`;
      const plan=permanencePlanning[d]||{};
      const matin=plan.matin||{}, soir=plan.soir||{}, tranche=plan.tranche||{};
      return `<tr style="border-bottom:1px solid #f0f2f5;" data-date="${d}">
        <td style="padding:6px 8px;font-weight:700;white-space:nowrap;">${label}</td>
        <td style="padding:6px 8px;">
          <select class="task-mgmt-role-select" style="margin:0;font-size:12px;" data-slot="matin" data-field="userId">
            ${userOptions(matin.userId)}</select></td>
        <td style="padding:6px 8px;">
          <select class="task-mgmt-role-select" style="margin:0;font-size:12px;" data-slot="soir" data-field="userId">
            ${userOptions(soir.userId)}</select></td>
        <td style="padding:6px 8px;">
          <select class="task-mgmt-role-select" style="margin:0 0 4px;font-size:12px;" data-slot="tranche" data-field="userId">
            ${userOptions(tranche.userId)}</select>
          <div style="display:flex;gap:4px;">
            <input type="time" value="${tranche.heureDebut||''}" data-slot="tranche" data-field="heureDebut"
              style="flex:1;padding:5px;border-radius:6px;border:1.5px solid var(--border);font-size:11px;">
            <input type="time" value="${tranche.heureFin||''}" data-slot="tranche" data-field="heureFin"
              style="flex:1;padding:5px;border-radius:6px;border:1.5px solid var(--border);font-size:11px;">
          </div></td>
      </tr>`;
    }).join('')}
    </tbody></table></div>`;
}

export function savePermanencePlanningForm(onDone) {
  const el=document.getElementById('permanence-planning-table'); if(!el) return;
  el.querySelectorAll('tr[data-date]').forEach(tr=>{
    const date=tr.dataset.date;
    if(!permanencePlanning[date]) permanencePlanning[date]={};
    ['matin','soir','tranche'].forEach(slot=>{
      if(!permanencePlanning[date][slot]) permanencePlanning[date][slot]={};
    });
    tr.querySelectorAll('[data-slot]').forEach(input=>{
      permanencePlanning[date][input.dataset.slot][input.dataset.field]=input.value||'';
    });
  });
  savePermanencePlanning();
  onDone&&onDone();
}
