import { _sb, _sbClient, _fbConnected, initSupabase, loadFirebaseConfig,
         DEFAULT_CONFIG, persistFirebaseConfig } from './services/supabase.js';
import { currentUser, usersData, setCurrentUser, setUsersData,
         initAuth, doLogin, doLogout, saveUsers, hashStr,
         ROLE_COLORS, ROLE_LABELS, isDirecteur, canEditRole,
         getAccessibleRoles, togglePwVis } from './auth/index.js';
import { completions, customTasks, completionLog, taskOverrides, taskNotes,
         setCompletions, setCustomTasks, setCompletionLog, setTaskOverrides, setTaskNotes,
         FC, FL, toggleTask, saveData, saveTaskNotes, purgeOldDailyCompletions,
         todayKey, periodKey, isTaskDone, getTaskNote, getTaskNoteAny,
         deadlinePeriodInfo, countWords, fmtDate, fmtDateStr,
         getWeekDates, getQuarterDates, getYearDates } from './tasks/index.js';
import { renderTasks, renderRoleHeader, renderProgressBar,
         openTaskNoteModal, updateNoteWordCount,
         handleNoteFileChange, removeNoteFile } from './tasks/ui.js';
import { renderDashboard, getRoleStats, getSecteurStats, getGlobalStats } from './dashboard/index.js';
import { renderUsersList, toggleUserActive, deleteUser,
         openUserModal, saveUserFromModal, resetUserPw,
         onSysRoleChange, setAllEvalChk, setEvalChkBySysRole } from './users/index.js';
import { companyData, customRoles, customRayons,
         setCompanyData, setCustomRoles, setCustomRayons,
         saveCompanyData, saveRayons, saveCustomRoles,
         renderSettingsForm, saveSettings, updateHeaderCompany,
         renderRayonsList, renderSelectRayon, renderFirebaseConfigForm,
         showFirebaseStatus, saveFirebaseConfig, renderCustomRolesList,
         handleLogoUpload, removeLogo, exportDataJSON, confirmReset } from './settings/index.js';
import { setupRealtimeListeners, startSupabasePoll,
         pushTaskEventToAdmin, _eventsCache } from './realtime/index.js';
import { renderExportScope, toggleScope,
         generateReportHTML, exportPDF } from './exports/index.js';
import { renderResults, setResType } from './exports/results.js';
import { requestNotifPermission, updateNotifBtnState,
         sendNotif, checkUpcomingTaskNotifs,
         notifyAdminTaskDone, resetNotifSentKeys } from './notifications/index.js';
import { PERM_ROLE_IDS, permanencePlanning, setPermanencePlanning,
         isPermanenceRole, getPermanenceAssignedName,
         savePermanenceOutgoingNote, savePermanencePlanning,
         renderPermanenceBanner, permanenceTodayBannerHtml,
         renderPermanencePlanning, savePermanencePlanningForm } from './permanence/index.js';

// ── État UI ───────────────────────────────────────────────────
let currentView   = 'dashboard';
let currentRoleId = 'cdp_pgc';
let viewMode      = 'role';
let rayonActif    = null;
let dashPeriod    = 'Q';
window._currentFreq = 'ALL';

// ── Données métier ROLES ──────────────────────────────────────
const ROLES = [
  {secteur:'Commercial',id:'cdp_pgc',label:'Chef Département PGC',sous:'Produits Grande Consommation',color:'#1a6b3c',light:'#e8f5ee',icon:'🛒',gere:['Chefs de rayon PGC'],rayons:[],taches:[]},
  {secteur:'Commercial',id:'cdp_frais',label:'Chef Département Frais',sous:'Produits Frais & Ultra-Frais',color:'#2980b9',light:'#eaf4fb',icon:'🌡️',gere:['Chefs de rayon Frais'],rayons:[],taches:[]},
  {secteur:'Commercial',id:'cdp_bazar',label:'Chef Département Bazar/Textile',sous:'Non-Alimentaire',color:'#d35400',light:'#fdf0e8',icon:'🧴',gere:['Chefs de rayon Bazar'],rayons:[],taches:[]},
  {secteur:'Commercial',id:'chef_rayon',label:'Chef de Rayon',sous:'Responsable d\'un rayon',color:'#8e44ad',light:'#f5eef8',icon:'📦',gere:['Employés commerciaux'],rayons:[],taches:[]},
  {secteur:'Commercial',id:'employe',label:'Employé Commercial',sous:'Tous rayons',color:'#27ae60',light:'#eafaf1',icon:'🧑‍💼',gere:[],rayons:[],taches:[]},
  {secteur:'Services',id:'resp_rh',label:'Responsable RH',sous:'Ressources Humaines',color:'#2c3e50',light:'#eaecee',icon:'👥',gere:['Assistants RH'],rayons:[],taches:[]},
  {secteur:'Services',id:'resp_caisse',label:'Responsable Caisse',sous:'Département Caisse',color:'#27ae60',light:'#eafaf1',icon:'💰',gere:['Hôtesses de caisse'],rayons:[],taches:[]},
  {secteur:'Services',id:'resp_secu',label:'Responsable Sécurité',sous:'Prévention & Sûreté',color:'#e74c3c',light:'#fdecea',icon:'🛡️',gere:['Agents de sécurité'],rayons:[],taches:[]},
  {secteur:'Services',id:'resp_logistique',label:'Responsable Logistique',sous:'Entrepôt & Réception',color:'#7f8c8d',light:'#f2f3f4',icon:'🚚',gere:['Manutentionnaires'],rayons:[],taches:[]},
  {secteur:'Permanence',id:'perm_matin',label:'Permanencier Matin',sous:'Continuité Magasin · avant 12:00',color:'#f39c12',light:'#fef9f0',icon:'🌅',gere:[],rayons:[],taches:[
    {id:'perm_m01',freq:'Q',deadline:'12:00',label:'Lecture de la note de passation (Soir précédent)'},
    {id:'perm_m02',freq:'Q',deadline:'12:00',label:'Tour d\'ouverture complet — sécurité, accès, alarme'},
    {id:'perm_m03',freq:'Q',deadline:'12:00',label:'Vérification présence encadrement par secteur'},
    {id:'perm_m04',freq:'Q',deadline:'12:00',label:'Contrôle affichage prix et promotions du jour'},
    {id:'perm_m05',freq:'Q',deadline:'12:00',label:'Validation ouverture des caisses et fonds de caisse'},
    {id:'perm_m06',freq:'Q',deadline:'12:00',label:'Brief court avec les chefs de rayon présents'},
    {id:'perm_m07',freq:'Q',deadline:'12:00',label:'Traitement des urgences et réclamations remontées'},
    {id:'perm_m08',freq:'Q',deadline:'12:00',label:'Contrôle températures chambres froides / surgelés'},
    {id:'perm_m09',freq:'Q',deadline:'12:00',label:'Rédaction de la note de passation pour la suite'},
  ]},
  {secteur:'Permanence',id:'perm_soir',label:'Permanencier Soir',sous:'Continuité Magasin · avant 22:00',color:'#34495e',light:'#eaecee',icon:'🌙',gere:[],rayons:[],taches:[
    {id:'perm_s01',freq:'Q',deadline:'22:00',label:'Lecture de la note de passation du créneau précédent'},
    {id:'perm_s02',freq:'Q',deadline:'22:00',label:'Ronde générale tous secteurs avant fermeture'},
    {id:'perm_s03',freq:'Q',deadline:'22:00',label:'Contrôle clôture caisses et arrêté journalier'},
    {id:'perm_s04',freq:'Q',deadline:'22:00',label:'Vérification fermeture issues, alarme, vidéosurveillance'},
    {id:'perm_s05',freq:'Q',deadline:'22:00',label:'Validation rangement réserve et zones de stockage'},
    {id:'perm_s06',freq:'Q',deadline:'22:00',label:'Rapport des incidents de la journée'},
    {id:'perm_s07',freq:'Q',deadline:'22:00',label:'Vérification présence agents de sécurité pour la nuit'},
    {id:'perm_s08',freq:'Q',deadline:'22:00',label:'Rédaction de la note de passation pour le Matin suivant'},
  ]},
  {secteur:'Permanence',id:'perm_tranche',label:'Permanencier Tranche',sous:'Continuité Magasin · horaire variable',color:'#16a085',light:'#e8f8f5',icon:'🔄',gere:[],rayons:[],taches:[
    {id:'perm_t01',freq:'Q',label:'Lecture de la note de passation (Matin)'},
    {id:'perm_t02',freq:'Q',label:'Tour de supervision des rayons sans encadrement'},
    {id:'perm_t03',freq:'Q',label:'Gestion des réclamations et incidents du créneau'},
    {id:'perm_t04',freq:'Q',label:'Contrôle des relais de pause déjeuner'},
    {id:'perm_t05',freq:'Q',label:'Vérification continuité affichage prix et balisage'},
    {id:'perm_t06',freq:'Q',label:'Suivi des ruptures signalées pendant le créneau'},
    {id:'perm_t07',freq:'Q',label:'Rédaction de la note de passation pour le créneau suivant'},
  ]},
];
// ── Helpers rôles ─────────────────────────────────────────────
export function getAllRoles()  { return [...ROLES, ...(customRoles||[])]; }
export function getRole(id)   { return getAllRoles().find(r=>r.id===id); }
export function getAllTasks(rid) {
  const r=getRole(rid); if(!r) return [];
  const baseTasks=r.taches.filter(t=>!isTaskHidden(rid,t.id)).map(t=>getTaskEffective(r,t));
  const allCustom=(customTasks[rid]||[]);
  const uid=currentUser?.id; const isAdmin=isDirecteur();
  const filteredCustom=isAdmin?allCustom:allCustom.filter(t=>!t.assignedTo||t.assignedTo===''||t.assignedTo===uid);
  const today=new Date();
  const joursMap={0:'Dim',1:'Lun',2:'Mar',3:'Mer',4:'Jeu',5:'Ven',6:'Sam'};
  const todayName=joursMap[today.getDay()]; const todayDate=today.getDate();
  return [...baseTasks, ...filteredCustom.filter(t=>{
    if(t.freq==='Q') return true;
    if(t.freq==='H') return !t.jours||!t.jours.length||t.jours.includes(todayName);
    if(t.freq==='M') return !t.datesMois||!t.datesMois.length||t.datesMois.map(d=>parseInt(d)).includes(todayDate);
    return true;
  })];
}
function getTaskEffective(role, task) {
  const ov=(taskOverrides[role.id]||{})[task.id];
  if(!ov) return task;
  return {...task, label:ov.label||task.label, note:ov.note!==undefined?ov.note:task.note, freq:ov.freq||task.freq};
}
function isTaskHidden(rid, tid) { return !!(taskOverrides[rid]||{})[tid]?.hidden; }

// Exposer globalement
window._getAllRoles = getAllRoles;
window._getAllTasks = getAllTasks;
window._getUsersData = () => usersData;

// ── Toast ─────────────────────────────────────────────────────
export function showToast(msg, color='#1a1f2e') {
  const t=document.getElementById('toast'); if(!t) return;
  t.textContent=msg; t.style.background=color;
  t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2500);
}
window.showToast = showToast;

// ── Vues ──────────────────────────────────────────────────────
export function showView(v) {
  if(v==='settings'&&!isDirecteur()){showToast('Accès réservé au Directeur','#e74c3c');return;}
  currentView=v;
  document.querySelectorAll('.view').forEach(el=>el.classList.remove('active'));
  document.querySelectorAll('.hdr-tab').forEach(el=>el.classList.remove('active'));
  document.getElementById('view-'+v)?.classList.add('active');
  const idx={dashboard:0,tasks:1,results:2,export:3,settings:4}[v];
  if(idx!==undefined) document.querySelectorAll('.hdr-tab')[idx]?.classList.add('active');
  if(v==='dashboard') _renderDashboard();
  if(v==='tasks')     { renderSidebar(); renderTaskView(); }
  if(v==='results')   renderResults(getAllRoles, getAllTasks);
  if(v==='export')    renderExportScope();
  if(v==='settings')  {
    renderSettingsForm(); renderUsersList(); renderFirebaseConfigForm();
    renderCustomRolesList(); renderRayonsList(); renderPermanencePlanning();
  }
}
window.showView = showView;

function _renderDashboard() {
  const bannerEl=document.getElementById('dash-perm-banner');
  if(bannerEl) bannerEl.innerHTML=permanenceTodayBannerHtml(
    (rid,freq)=>getRoleStats(rid,freq,getAllTasks)
  );
  renderDashboard(dashPeriod, getAllRoles, getAllTasks, companyData);
}

// ── Sidebar ────────────────────────────────────────────────────
function renderSidebar() {
  const sb=document.getElementById('sidebar'); if(!sb) return;
  const accessible=getAccessibleRoles(getAllRoles);
  const secteurs=[...new Set(accessible.map(r=>r.secteur))];
  sb.innerHTML='<div class="sb-label">Fonctions accessibles</div>'+
    secteurs.map(sect=>`
      <div class="sb-label">${sect}</div>
      ${accessible.filter(r=>r.secteur===sect).map(r=>{
        const rs=getRoleStats(r.id,'ALL',getAllTasks);
        const rc=rs.pct>=80?'#27ae60':rs.pct>=50?'#f39c12':'#e74c3c';
        const isActive=r.id===currentRoleId;
        return `<button class="role-btn${isActive?' active':''}" style="--rc:${r.color};--rl:${r.light}" onclick="window.selectRole('${r.id}')">
          <div class="rb-top"><span class="rb-icon">${r.icon}</span><span class="rb-name">${r.label}</span>
          <span class="rb-badge" style="background:${rc}18;color:${rc}">${rs.pct}%</span></div>
          <div class="rb-bar-wrap"><div class="rb-bar" style="width:${rs.pct}%;background:${rc}"></div></div>
          <div class="rb-ct">${rs.done}/${rs.total}</div>
        </button>`;
      }).join('')}`).join('');
}

// ── Vue tâches ────────────────────────────────────────────────
function renderTaskView() {
  const r=getRole(currentRoleId); if(!r) return;
  renderRoleHeader(currentRoleId, getRole, (rid)=>getRoleStats(rid,'ALL',getAllTasks));
  renderTasks(currentRoleId, getRole, getAllTasks);
  renderProgressBar(currentRoleId, getRole, getAllTasks);
  renderPermanenceBanner(currentRoleId, viewMode);
  const addBtn=document.getElementById('add-btn');
  if(addBtn) addBtn.style.display=isDirecteur()?'flex':'none';
}
window._rerenderTasks = renderTaskView;

// ── Handlers globaux ──────────────────────────────────────────
window.selectRole = function(rid) {
  currentRoleId=rid; renderSidebar(); renderTaskView();
  if(window.innerWidth<=640) window.closeSidebar();
};

window.handleToggleTask = function(tid, freq) {
  const result=toggleTask(currentRoleId,tid,freq,getAllTasks,({isDone})=>{
    const r=getRole(currentRoleId);
    const task=getAllTasks(currentRoleId).find(t=>t.id===tid);
    if(task) {
      pushTaskEventToAdmin(tid,freq,isDone,task,r,periodKey);
      notifyAdminTaskDone(task.label,currentUser?.name||'?',r.label,r.icon,isDone);
    }
  });
  if(result.error){showToast(result.error,'#e74c3c');return;}
  renderTaskView(); _renderDashboard();
};

window.openTaskNoteModal = function(tid, freq) {
  openTaskNoteModal(tid,freq,currentRoleId,getTaskNote);
};
window.updateNoteWordCount = updateNoteWordCount;
window.handleNoteFileChange = handleNoteFileChange;
window.removeNoteFile = removeNoteFile;

window.setDashPeriod = function(p, btn) {
  dashPeriod=p;
  document.querySelectorAll('.period-btn').forEach(b=>b.classList.remove('active'));
  btn?.classList.add('active');
  _renderDashboard();
};

window.setFreq = function(f) {
  window._currentFreq=f;
  document.querySelectorAll('.freq-btn[data-freq]').forEach(b=>b.classList.toggle('active',b.dataset.freq===f));
  renderTaskView();
};

window.setResType  = setResType;
window.toggleScope = toggleScope;
window.togglePwVis = togglePwVis;
window.saveSettings = saveSettings;
window.saveFirebaseConfig = saveFirebaseConfig;
window.handleLogoUpload   = handleLogoUpload;
window.removeLogo         = removeLogo;
window.exportDataJSON     = exportDataJSON;
window.confirmReset       = confirmReset;
window.openEditUserModal  = (id)=>openUserModal(id, getAllRoles);
window.toggleUserActive   = toggleUserActive;
window.deleteUser         = deleteUser;
window.onSysRoleChange    = onSysRoleChange;
window.setAllEvalChk      = setAllEvalChk;
window.deleteCustomRole   = function(id){ const idx=customRoles.findIndex(r=>r.id===id); if(idx>-1) customRoles.splice(idx,1); saveCustomRoles(); renderCustomRolesList(); renderSidebar(); _renderDashboard(); };
window.deleteRayon        = function(id){ delete customRayons[id]; saveRayons(); renderRayonsList(); renderSelectRayon(); };
window.requestNotifPermission = requestNotifPermission;
window.savePermanenceOutgoingNote = function(rid){ savePermanenceOutgoingNote(rid); showToast('📝 Note enregistrée','#27ae60'); };
window.savePermanencePlanningForm = function(){ savePermanencePlanningForm(()=>{ _renderDashboard(); showToast('✅ Planning enregistré','#27ae60'); }); };
window._goToPermanenceRole = function(rid){ viewMode='role'; currentRoleId=rid; showView('tasks'); };
window.toggleSidebar  = ()=>{ document.getElementById('sidebar')?.classList.toggle('open'); document.getElementById('sidebar-overlay')?.classList.toggle('open'); };
window.closeSidebar   = ()=>{ document.getElementById('sidebar')?.classList.remove('open'); document.getElementById('sidebar-overlay')?.classList.remove('open'); };
window.showUserMenu   = ()=>{ document.getElementById('user-menu').style.display='block'; document.getElementById('user-menu-overlay').style.display='block'; };
window.closeUserMenu  = ()=>{ document.getElementById('user-menu').style.display='none'; document.getElementById('user-menu-overlay').style.display='none'; };
window.openModal      = ()=>{ document.getElementById('modal-overlay')?.classList.add('open'); };
window.closeModal     = ()=>{ document.getElementById('modal-overlay')?.classList.remove('open'); window._modalSaveCallback=null; };
window.modalSave      = ()=>{ window._modalSaveCallback&&window._modalSaveCallback(); };
window.setViewMode    = function(mode) {
  viewMode=mode;
  const tBtn=document.querySelector('.freq-btn[data-freq="T"]');
  const aBtn=document.querySelector('.freq-btn[data-freq="A"]');
  if(tBtn) tBtn.style.display=mode==='rayon'?'none':'';
  if(aBtn) aBtn.style.display=mode==='rayon'?'none':'';
  if(mode==='rayon'&&(window._currentFreq==='T'||window._currentFreq==='A')) window._currentFreq='ALL';
  if(mode==='rayon'){ renderSelectRayon(); }
  else { renderSidebar(); renderTaskView(); }
};// ── Login UI ──────────────────────────────────────────────────
function showLoginError(msg) {
  const el=document.getElementById('login-error');
  if(el){el.textContent=msg;el.style.display='block';}
}
function showLoginScreen() {
  document.getElementById('login-overlay')?.classList.remove('hidden');
  if(companyData.nom){
    const el=document.getElementById('login-company-name');
    if(el) el.textContent=companyData.nom.toUpperCase();
  }
}
function setLoginReady(ready, msg) {
  const btn=document.getElementById('btn-login'); if(!btn) return;
  btn.disabled=!ready; btn.style.opacity=ready?'1':'0.6';
  btn.innerHTML=ready?'🔐 Connexion':'⏳ '+(msg||'Chargement...');
}

// ── On login success ──────────────────────────────────────────
function onLoginSuccess(user) {
  setCurrentUser(user);
  const uid=user.id;
  try {
    const s=localStorage.getItem('hm_comp_'+uid);
    const raw=s?JSON.parse(s):{};
    const today=todayKey();
    Object.keys(raw).forEach(k=>{const m=k.match(/__(\d{4}-\d{2}-\d{2})$/);if(m&&m[1]!==today)delete raw[k];});
    setCompletions(raw);
  } catch(e){setCompletions({});}
  document.getElementById('login-overlay')?.classList.add('hidden');
  updateHeaderUser(); applyAccessControl();
  const today=new Date().toISOString().slice(0,10);
  ['date-daily','date-from','date-to','res-date'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value=today;
  });
  _renderDashboard(); showView('dashboard');
  if(_sbClient&&_fbConnected) loadDataFromSupabase(uid);
}

async function loadDataFromSupabase(uid) {
  if(isDirecteur()) {
    const [sbUsers,rows,ct,ov,cr,sbRayons,tn,pp]=await Promise.all([
      _sb.get('hm_app_data','hm_users'),
      _sb.getAll('hm_completions'),
      _sb.get('hm_app_data','hm_custom_tasks'),
      _sb.get('hm_app_data','hm_task_overrides'),
      _sb.get('hm_app_data','hm_custom_roles'),
      _sb.get('hm_app_data','hm_rayons'),
      _sb.get('hm_app_data','hm_task_notes'),
      _sb.get('hm_app_data','hm_permanence_planning'),
    ]).catch(()=>[]);
    if(sbUsers&&Array.isArray(sbUsers)){setUsersData(sbUsers);localStorage.setItem('hm_users',JSON.stringify(sbUsers));renderUsersList();}
    if(rows&&rows.length>0){
      let merged={}; const today=todayKey();
      rows.forEach(r=>{if(r.data&&typeof r.data==='object') Object.assign(merged,r.data);});
      Object.keys(merged).forEach(k=>{const m=k.match(/__(\d{4}-\d{2}-\d{2})$/);if(m&&m[1]!==today)delete merged[k];});
      setCompletions(merged); localStorage.setItem('hm_comp_'+uid,JSON.stringify(merged));
    }
    if(ct&&typeof ct==='object'){setCustomTasks(ct);localStorage.setItem('hm_cust',JSON.stringify(ct));}
    if(ov&&typeof ov==='object'){setTaskOverrides(ov);localStorage.setItem('hm_overrides',JSON.stringify(ov));}
    if(cr&&Array.isArray(cr)){setCustomRoles(cr);localStorage.setItem('hm_custom_roles',JSON.stringify(cr));}
    if(sbRayons&&typeof sbRayons==='object'){setCustomRayons(sbRayons);localStorage.setItem('hm_rayons',JSON.stringify(sbRayons));}
    if(tn&&typeof tn==='object'){setTaskNotes(tn);localStorage.setItem('hm_task_notes',JSON.stringify(tn));}
    if(pp&&typeof pp==='object'){setPermanencePlanning(pp);localStorage.setItem('hm_permanence_planning',JSON.stringify(pp));}
  } else {
    const [myComp,ct,ov,cr,tn,pp]=await Promise.all([
      _sb.get('hm_completions',uid),
      _sb.get('hm_app_data','hm_custom_tasks'),
      _sb.get('hm_app_data','hm_task_overrides'),
      _sb.get('hm_app_data','hm_custom_roles'),
      _sb.get('hm_app_data','hm_task_notes'),
      _sb.get('hm_app_data','hm_permanence_planning'),
    ]).catch(()=>[]);
    if(myComp&&typeof myComp==='object'){
      const today=todayKey();
      Object.keys(myComp).forEach(k=>{const m=k.match(/__(\d{4}-\d{2}-\d{2})$/);if(m&&m[1]!==today)delete myComp[k];});
      setCompletions(myComp); localStorage.setItem('hm_comp_'+uid,JSON.stringify(myComp));
    }
    if(ct&&typeof ct==='object'){setCustomTasks(ct);localStorage.setItem('hm_cust',JSON.stringify(ct));}
    if(ov&&typeof ov==='object'){setTaskOverrides(ov);localStorage.setItem('hm_overrides',JSON.stringify(ov));}
    if(cr&&Array.isArray(cr)){setCustomRoles(cr);localStorage.setItem('hm_custom_roles',JSON.stringify(cr));}
    if(tn&&typeof tn==='object'){setTaskNotes(tn);localStorage.setItem('hm_task_notes',JSON.stringify(tn));}
    if(pp&&typeof pp==='object'){setPermanencePlanning(pp);localStorage.setItem('hm_permanence_planning',JSON.stringify(pp));}
  }
  _renderDashboard(); renderTaskView(); renderSidebar();
  setupRealtimeListeners({
    onCompletionsChanged:()=>{ _renderDashboard(); renderTaskView(); },
    onEventsChanged:()=>{},
    onAppDataChanged:(key,fresh)=>{
      if(key==='hm_users'&&Array.isArray(fresh)){setUsersData(fresh);renderUsersList();}
      if(key==='hm_custom_roles'&&Array.isArray(fresh)){setCustomRoles(fresh);renderCustomRolesList();_renderDashboard();renderSidebar();}
      if(key==='hm_custom_tasks'&&typeof fresh==='object'){setCustomTasks(fresh);renderTaskView();}
      if(key==='hm_task_overrides'&&typeof fresh==='object'){setTaskOverrides(fresh);renderTaskView();}
      if(key==='hm_task_notes'&&typeof fresh==='object'){setTaskNotes(fresh);renderTaskView();}
      if(key==='hm_company'&&typeof fresh==='object'){Object.assign(companyData,fresh);updateHeaderCompany();}
      if(key==='hm_rayons'&&typeof fresh==='object'){setCustomRayons(fresh);renderSelectRayon();renderRayonsList();}
      if(key==='hm_permanence_planning'&&typeof fresh==='object'){setPermanencePlanning(fresh);_renderDashboard();renderPermanenceBanner(currentRoleId,viewMode);}
    }
  });
}

function applyAccessControl() {
  const isDir=isDirecteur();
  ['users-mgmt-card','data-mgmt-card'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.style.display=isDir?'block':'none';
  });
  const liveWrap=document.getElementById('hdr-live-btn-wrap');
  if(liveWrap) liveWrap.style.display=isDir?'flex':'none';
  const tabSettings=document.getElementById('tab-settings');
  if(tabSettings) tabSettings.style.display=isDir?'':'none';
  const accessible=getAccessibleRoles(getAllRoles);
  if(accessible.length>0){
    if(currentUser?.ownRoleId&&getRole(currentUser.ownRoleId)) currentRoleId=currentUser.ownRoleId;
    else currentRoleId=accessible[0].id;
  }
}

function updateHeaderUser() {
  if(!currentUser) return;
  const hn=document.getElementById('hdr-user-name'); if(hn) hn.textContent=currentUser.name;
  const dot=document.getElementById('hdr-user-dot'); if(dot) dot.style.background=ROLE_COLORS[currentUser.systemRole]||'#27ae60';
  const un=document.getElementById('um-name'); if(un) un.textContent=currentUser.name;
  const ur=document.getElementById('um-role'); if(ur) ur.textContent=ROLE_LABELS[currentUser.systemRole]||'—';
  updateHeaderCompany();
  updateNotifBtnState();
}

// ── Chargement local ──────────────────────────────────────────
function loadLocalData() {
  try{setCustomTasks(JSON.parse(localStorage.getItem('hm_cust')||'{}'));}catch(e){}
  try{setCompletionLog(JSON.parse(localStorage.getItem('hm_log')||'[]'));}catch(e){}
  try{setTaskOverrides(JSON.parse(localStorage.getItem('hm_overrides')||'{}'));}catch(e){}
  try{setTaskNotes(JSON.parse(localStorage.getItem('hm_task_notes')||'{}'));}catch(e){}
  try{setCustomRoles(JSON.parse(localStorage.getItem('hm_custom_roles')||'[]'));}catch(e){}
  try{setCompanyData(Object.assign({nom:'',logo:null,address:'',phone:'',email:'',web:'',
    directorName:'',directorTitle:'Directeur',directorPhone:'',directorEmail:'',
    orgName:'',orgRef:'',orgAddress:'',orgContact:'',orgPerson:''},
    JSON.parse(localStorage.getItem('hm_company')||'{}')));}catch(e){}
  try{setUsersData(JSON.parse(localStorage.getItem('hm_users')||'[]'));}catch(e){}
  try{setCustomRayons(JSON.parse(localStorage.getItem('hm_rayons')||'{}')||{});}catch(e){}
  try{setPermanencePlanning(JSON.parse(localStorage.getItem('hm_permanence_planning')||'{}')||{});}catch(e){}
  const existingAdmin=usersData.find(u=>u.username==='admin');
  if(!existingAdmin){
    const adminDef={id:'u_admin',name:'Directeur',username:'admin',
      passwordHash:hashStr('1234'),systemRole:'directeur',ownRoleId:null,
      evaluableRoleIds:getAllRoles().map(r=>r.id),active:true,
      createdAt:new Date().toISOString()};
    usersData.length?usersData.unshift(adminDef):setUsersData([adminDef]);
    try{saveUsers();}catch(e){}
  }
}

// ── Init Supabase ─────────────────────────────────────────────
async function initFirebaseOnStartup() {
  const storedCfg=loadFirebaseConfig();
  const cfg=storedCfg||DEFAULT_CONFIG;
  if(!storedCfg) persistFirebaseConfig(DEFAULT_CONFIG);
  setTimeout(()=>setLoginReady(false,'Connexion Supabase...'),50);
  let started=false;
  const start=()=>{ if(started)return; started=true; initAuth(onLoginSuccess,showLoginScreen); };
  const fallback=setTimeout(()=>{setLoginReady(true);start();},8000);
  try {
    await initSupabase(cfg); clearTimeout(fallback); setLoginReady(true);
    const sbUsers=await _sb.get('hm_app_data','hm_users').catch(()=>null);
    if(sbUsers&&Array.isArray(sbUsers)&&sbUsers.length>0){
      setUsersData(sbUsers); localStorage.setItem('hm_users',JSON.stringify(sbUsers));
    }
    start();
  } catch(e) { clearTimeout(fallback); setLoginReady(true); start(); }
}

// ── Login listeners ───────────────────────────────────────────
function attachLoginListeners() {
  const btnEye=document.getElementById('btn-pw-eye');
  const pwInput=document.getElementById('login-password');
  const unInput=document.getElementById('login-username');
  if(btnEye) btnEye.addEventListener('click',e=>{e.preventDefault();togglePwVis('login-password',btnEye);});
  if(pwInput) pwInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();window.doLogin(unInput?.value,pwInput?.value);}});
  if(unInput) unInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();pwInput?.focus();}});
  document.getElementById('btn-login')?.addEventListener('click',()=>window.doLogin(unInput?.value,pwInput?.value));
}

window.doLogin  = (un,pw)=>doLogin(un,pw,onLoginSuccess,showLoginError);
window.doLogout = function(){doLogout();location.reload();};

// ── Veilleur minuit ───────────────────────────────────────────
let _dailyWatcherDate=new Date().toISOString().slice(0,10);
setInterval(()=>{
  const now=new Date().toISOString().slice(0,10);
  if(now!==_dailyWatcherDate){
    _dailyWatcherDate=now; resetNotifSentKeys();
    purgeOldDailyCompletions(completions);
    _renderDashboard(); renderTaskView();
  }
},30000);

// Rappels notifications toutes les minutes
setInterval(()=>{ checkUpcomingTaskNotifs(getAllRoles,getAllTasks,customTasks); },60000);

// ── VH mobile ─────────────────────────────────────────────────
function setVH(){document.documentElement.style.setProperty('--vh',(window.innerHeight*0.01)+'px');}
window.addEventListener('resize',setVH); setVH();
window.addEventListener('beforeunload',()=>{saveData();saveCompanyData();});

// ── Démarrage ─────────────────────────────────────────────────
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',()=>{loadLocalData();attachLoginListeners();updateHeaderCompany();initFirebaseOnStartup();});
} else {
  loadLocalData(); attachLoginListeners(); updateHeaderCompany(); initFirebaseOnStartup();
}

if('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
