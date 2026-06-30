import { _sb, _sbClient, _fbConnected, loadFirebaseConfig,
         persistFirebaseConfig, initSupabase } from '../services/supabase.js';
import { isDirecteur } from '../auth/index.js';

export let companyData = {
  nom:'', logo:null, address:'', phone:'', email:'', web:'',
  directorName:'', directorTitle:'Directeur', directorPhone:'', directorEmail:'',
  orgName:'', orgRef:'', orgAddress:'', orgContact:'', orgPerson:''
};
export let customRoles  = [];
export let customRayons = {};

export function setCompanyData(v)  { companyData  = v; }
export function setCustomRoles(v)  { customRoles  = v; }
export function setCustomRayons(v) { customRayons = v; }

export function saveCompanyData() {
  try { localStorage.setItem('hm_company',JSON.stringify(companyData)); } catch(e) {}
  if(_sbClient&&_fbConnected) _sb.set('hm_app_data','hm_company',companyData).catch(()=>{});
}
export function saveRayons() {
  try { localStorage.setItem('hm_rayons',JSON.stringify(customRayons)); } catch(e) {}
  if(_sbClient&&_fbConnected) _sb.set('hm_app_data','hm_rayons',customRayons).catch(()=>{});
}
export function saveCustomRoles() {
  try { localStorage.setItem('hm_custom_roles',JSON.stringify(customRoles)); } catch(e) {}
  if(_sbClient&&_fbConnected) _sb.set('hm_app_data','hm_custom_roles',customRoles).catch(()=>{});
}

export function updateHeaderCompany() {
  const n=document.getElementById('hdr-company-name');
  const s=document.getElementById('hdr-company-sub');
  if(n) n.textContent=companyData.nom||'PILOTAGE OPÉRATIONNEL — DIRECTION HYPERMARCHÉ';
  if(s) s.textContent=companyData.directorName?`Direction : ${companyData.directorName}`:'Suivi des tâches · Dashboard global';
  const lc=document.getElementById('hdr-logo-container');
  if(lc) lc.innerHTML=companyData.logo?`<img src="${companyData.logo}" class="hdr-logo-img">`:'<span class="hdr-logo-text">🏬</span>';
}

export function renderSettingsForm() {
  const fields={
    'set-company-name':companyData.nom||'',
    'set-company-phone':companyData.phone||'',
    'set-company-address':companyData.address||'',
    'set-company-email':companyData.email||'',
    'set-company-web':companyData.web||'',
    'set-director-name':companyData.directorName||'',
    'set-director-title':companyData.directorTitle||'',
    'set-director-phone':companyData.directorPhone||'',
    'set-director-email':companyData.directorEmail||'',
    'set-org-name':companyData.orgName||'',
    'set-org-ref':companyData.orgRef||'',
    'set-org-address':companyData.orgAddress||'',
    'set-org-contact':companyData.orgContact||'',
    'set-org-person':companyData.orgPerson||''
  };
  Object.entries(fields).forEach(([id,val])=>{
    const el=document.getElementById(id); if(el) el.value=val;
  });
  const lp=document.getElementById('logo-preview');
  const lb=document.getElementById('logo-remove-btn');
  if(lp){
    if(companyData.logo){lp.src=companyData.logo;lp.classList.add('visible');if(lb)lb.style.display='block';}
    else{lp.classList.remove('visible');if(lb)lb.style.display='none';}
  }
}

export function saveSettings() {
  companyData.nom          =document.getElementById('set-company-name')?.value||'';
  companyData.phone        =document.getElementById('set-company-phone')?.value||'';
  companyData.address      =document.getElementById('set-company-address')?.value||'';
  companyData.email        =document.getElementById('set-company-email')?.value||'';
  companyData.web          =document.getElementById('set-company-web')?.value||'';
  companyData.directorName =document.getElementById('set-director-name')?.value||'';
  companyData.directorTitle=document.getElementById('set-director-title')?.value||'';
  companyData.directorPhone=document.getElementById('set-director-phone')?.value||'';
  companyData.directorEmail=document.getElementById('set-director-email')?.value||'';
  companyData.orgName      =document.getElementById('set-org-name')?.value||'';
  companyData.orgRef       =document.getElementById('set-org-ref')?.value||'';
  companyData.orgAddress   =document.getElementById('set-org-address')?.value||'';
  companyData.orgContact   =document.getElementById('set-org-contact')?.value||'';
  companyData.orgPerson    =document.getElementById('set-org-person')?.value||'';
  saveCompanyData();
}

export function handleLogoUpload(e) {
  const file=e.target.files[0]; if(!file) return;
  if(file.size>500000){window.showToast&&window.showToast('Logo trop lourd (max 500 Ko)','#e74c3c');return;}
  const reader=new FileReader();
  reader.onload=ev=>{
    companyData.logo=ev.target.result; saveCompanyData(); updateHeaderCompany();
    const lp=document.getElementById('logo-preview');
    const lb=document.getElementById('logo-remove-btn');
    if(lp){lp.src=ev.target.result;lp.classList.add('visible');}
    if(lb) lb.style.display='block';
    window.showToast&&window.showToast('✅ Logo enregistré','#27ae60');
  };
  reader.readAsDataURL(file);
}

export function removeLogo() {
  companyData.logo=null; saveCompanyData(); updateHeaderCompany();
  const lp=document.getElementById('logo-preview');
  const lb=document.getElementById('logo-remove-btn');
  if(lp) lp.classList.remove('visible');
  if(lb) lb.style.display='none';
}

export function renderRayonsList() {
  const el=document.getElementById('rayons-mgmt-list'); if(!el) return;
  const entries=Object.entries(customRayons);
  if(!entries.length){el.innerHTML='<div style="color:var(--muted);font-size:13px;padding:12px;">Aucun rayon défini.</div>';return;}
  el.innerHTML=entries.map(([id,r])=>`
    <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#f8f9fa;border-radius:10px;margin-bottom:8px;border-left:4px solid ${r.color||'#999'};">
      <span style="font-size:20px;">${r.icon||'📦'}</span>
      <div style="flex:1;"><div style="font-size:13px;font-weight:800;">${r.label}</div>
        <div style="font-size:11px;color:var(--muted);">${r.chefName||''}</div></div>
      <button onclick="window.deleteRayon('${id}')" style="background:#fdecea;border:none;border-radius:8px;padding:5px 10px;font-size:12px;cursor:pointer;color:#e74c3c;font-weight:700;">🗑️</button>
    </div>`).join('');
}

export function renderSelectRayon() {
  const sel=document.getElementById('selectRayon'); if(!sel) return;
  sel.innerHTML='<option value="">-- Choisir un rayon --</option>';
  Object.entries(customRayons).forEach(([id,r])=>{
    const o=document.createElement('option'); o.value=id; o.textContent=r.label; sel.appendChild(o);
  });
}

export function renderCustomRolesList() {
  const el=document.getElementById('custom-roles-list'); if(!el) return;
  if(!customRoles.length){el.innerHTML='<div style="text-align:center;color:var(--muted);font-size:13px;padding:16px;">Aucun département personnalisé</div>';return;}
  el.innerHTML=customRoles.map(r=>`
    <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#f8f9fa;border-radius:10px;margin-bottom:8px;border-left:4px solid ${r.color};">
      <span style="font-size:22px;">${r.icon}</span>
      <div style="flex:1;"><div style="font-size:13px;font-weight:800;">${r.label}</div>
        <div style="font-size:11px;color:var(--muted);">${r.secteur} · ${r.taches.length} tâche(s)</div></div>
      <button onclick="window.deleteCustomRole('${r.id}')" style="background:#fdecea;border:none;border-radius:8px;padding:5px 10px;font-size:12px;cursor:pointer;color:#e74c3c;font-weight:700;">🗑️</button>
    </div>`).join('');
}

export function renderFirebaseConfigForm() {
  const cfg=loadFirebaseConfig(); if(!cfg) return;
  const u=document.getElementById('fb-projectUrl');
  const k=document.getElementById('fb-anonKey');
  if(u) u.value=cfg.projectUrl||'';
  if(k) k.value=cfg.anonKey||'';
}

export function showFirebaseStatus(msg, color) {
  const el=document.getElementById('firebase-status-bar'); if(!el) return;
  el.textContent=msg; el.style.background=color+'22';
  el.style.color=color; el.style.display='block';
}

export async function saveFirebaseConfig() {
  const url=(document.getElementById('fb-projectUrl')||{}).value||'';
  const key=(document.getElementById('fb-anonKey')||{}).value||'';
  if(!url||!key){showFirebaseStatus('⚠️ URL et clé obligatoires','#e74c3c');return;}
  const cfg={projectUrl:url.trim(),anonKey:key.trim()};
  persistFirebaseConfig(cfg);
  try { await initSupabase(cfg); showFirebaseStatus('✅ Supabase connecté','#3ecf8e'); }
  catch(e) { showFirebaseStatus('❌ Erreur : '+e.message,'#e74c3c'); }
}

export function exportDataJSON() {
  const data={
    users:JSON.parse(localStorage.getItem('hm_users')||'[]'),
    completions:JSON.parse(localStorage.getItem('hm_comp')||'{}'),
    customTasks:JSON.parse(localStorage.getItem('hm_cust')||'{}'),
    taskOverrides:JSON.parse(localStorage.getItem('hm_overrides')||'{}'),
    company:JSON.parse(localStorage.getItem('hm_company')||'{}'),
    rayons:JSON.parse(localStorage.getItem('hm_rayons')||'{}'),
    customRoles:JSON.parse(localStorage.getItem('hm_custom_roles')||'[]'),
    exportedAt:new Date().toISOString()
  };
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download=`hm-backup-${new Date().toISOString().slice(0,10)}.json`; a.click();
}

export function confirmReset() {
  if(!confirm('⚠️ Réinitialiser TOUTES les données locales ? Cette action est irréversible.')) return;
  if(!confirm('Dernière confirmation — êtes-vous sûr ?')) return;
  ['hm_users','hm_comp','hm_cust','hm_log','hm_overrides','hm_company',
   'hm_rayons','hm_custom_roles','hm_task_notes','hm_permanence_planning',
   'hm_sb_cfg','hm_session'].forEach(k=>localStorage.removeItem(k));
  window.showToast&&window.showToast('✅ Données réinitialisées — rechargement...','#27ae60');
  setTimeout(()=>location.reload(),1500);
}


// ── Constantes pour modals Département/Rayon ─────────────────
export const DEPT_ICONS = ['🏢','🏪','🛒','📦','🔧','🧹','🍕','🥩','🍞','🧴','💊','👗','👟','📱','🖥️','🚗','🌿','🐟','🧃','🍷'];
export const DEPT_COLORS = ['#1a6b3c','#2980b9','#d35400','#8e44ad','#c0392b','#27ae60','#e67e22','#16a085','#2c3e50','#7f8c8d'];
