import { _sb, _sbClient, _fbConnected } from '../services/supabase.js';

export let currentUser = null;
export let usersData   = [];

export function setCurrentUser(u) { currentUser = u; }
export function setUsersData(arr) { usersData = arr; }

export const ROLE_COLORS = { directeur:'#e63950', chef_secteur:'#2980b9', chef_rayon:'#27ae60' };
export const ROLE_LABELS = {
  directeur:'Directeur (Admin)',
  chef_secteur:'Chef Secteur / Département',
  chef_rayon:'Chef de Rayon'
};

export function hashStr(s) {
  let h=0x811c9dc5; const full=s+'_hm_tarabet_sec';
  for(let i=0;i<full.length;i++){h^=full.charCodeAt(i);h=(h*0x01000193)>>>0;}
  return h.toString(16).padStart(8,'0');
}

export function isDirecteur() { return currentUser?.systemRole==='directeur'; }
export function isOwnRole(roleId) { return currentUser?.ownRoleId===roleId; }

export function canEditRole(roleId) {
  if(!currentUser) return false;
  if(isDirecteur()) return true;
  return (currentUser.evaluableRoleIds||[]).includes(roleId)||currentUser.ownRoleId===roleId;
}

export function getAccessibleRoles(getAllRoles) {
  if(!currentUser) return [];
  if(isDirecteur()) return getAllRoles();
  const ids=new Set([...(currentUser.evaluableRoleIds||[])]);
  if(currentUser.ownRoleId) ids.add(currentUser.ownRoleId);
  return getAllRoles().filter(r=>ids.has(r.id));
}

export function saveUsers() {
  try { localStorage.setItem('hm_users',JSON.stringify(usersData)); } catch(e) {}
  if(_sbClient&&_fbConnected) {
    _sb.set('hm_app_data','hm_users',usersData)
      .then(()=>{window._usersSyncPending=false;})
      .catch(()=>{window._usersSyncPending=true;});
  } else { window._usersSyncPending=true; }
}

export function initAuth(onSuccess, onFail) {
  try {
    const sess=JSON.parse(sessionStorage.getItem('hm_session')||'null');
    if(sess) {
      const u=usersData.find(x=>x.id===sess.userId&&x.active);
      if(u){currentUser=u; onSuccess(u); return;}
      sessionStorage.removeItem('hm_session');
    }
  } catch(e) {}
  onFail();
}

export async function doLogin(username, password, onSuccess, onError) {
  const un=(username||'').trim().toLowerCase();
  const pw=(password||'').trim();
  if(!un||!pw){onError('Veuillez remplir tous les champs.');return;}
  const hash=hashStr(pw);
  const user=usersData.find(u=>u.username===un&&u.passwordHash===hash&&u.active);
  if(user) {
    currentUser=user;
    sessionStorage.setItem('hm_session',JSON.stringify({userId:user.id,loginAt:new Date().toISOString()}));
    onSuccess(user); return;
  }
  if(_sbClient) {
    onError('⏳ Vérification finale...');
    try {
      const sbUsers=await _sb.get('hm_app_data','hm_users');
      if(sbUsers&&Array.isArray(sbUsers)&&sbUsers.length>0){
        usersData=sbUsers; localStorage.setItem('hm_users',JSON.stringify(usersData));
      }
      const u2=usersData.find(u=>u.username===un&&u.passwordHash===hash&&u.active);
      if(u2){
        currentUser=u2;
        sessionStorage.setItem('hm_session',JSON.stringify({userId:u2.id,loginAt:new Date().toISOString()}));
        onSuccess(u2);
      } else { onError('Identifiant ou mot de passe incorrect.'); }
    } catch { onError('Identifiant ou mot de passe incorrect.'); }
  } else { onError('Identifiant ou mot de passe incorrect.'); }
}

export function doLogout() {
  currentUser=null; sessionStorage.removeItem('hm_session');
}

export function togglePwVis(inputId, btn) {
  const el=document.getElementById(inputId);
  if(el.type==='password'){el.type='text';btn.textContent='🙈';}
  else{el.type='password';btn.textContent='👁️';}
}
