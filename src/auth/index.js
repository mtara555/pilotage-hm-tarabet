// ══════════════════════════════════════════════════════════════
// auth/index.js — Authentification Supabase Auth natif
// JWT token géré automatiquement — plus de hash FNV-1a
// ══════════════════════════════════════════════════════════════
import { _sbClient, _fbConnected } from '../services/supabase.js';

// ── État ──────────────────────────────────────────────────────
export let currentUser = null;
export let usersData   = [];

export function setCurrentUser(u) { currentUser = u; }
export function setUsersData(arr) { usersData = arr; }

export const ROLE_COLORS = {
  directeur:'#e63950', chef_secteur:'#2980b9', chef_rayon:'#27ae60'
};
export const ROLE_LABELS = {
  directeur:'Directeur (Admin)',
  chef_secteur:'Chef Secteur / Département',
  chef_rayon:'Chef de Rayon'
};

// ── Hash FNV-1a (gardé pour compatibilité données locales) ────
export function hashStr(s) {
  let h=0x811c9dc5; const full=s+'_hm_tarabet_sec';
  for(let i=0;i<full.length;i++){h^=full.charCodeAt(i);h=(h*0x01000193)>>>0;}
  return h.toString(16).padStart(8,'0');
}

// ── Helpers rôles ─────────────────────────────────────────────
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

// ── Sauvegarde users (profils Supabase) ───────────────────────
export function saveUsers() {
  try { localStorage.setItem('hm_users',JSON.stringify(usersData)); } catch(e) {}
  if(_sbClient && _fbConnected) {
    // Sauvegarder aussi dans hm_app_data pour compatibilité
    _sbClient.from('hm_app_data')
      .upsert({key:'hm_users', data:usersData})
      .catch(()=>{});
  }
}

// ── Charger le profil depuis hm_profiles ─────────────────────
async function loadProfile(authUser) {
  if(!_sbClient) return null;
  const { data, error } = await _sbClient
    .from('hm_profiles')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle();
  if(error || !data) return null;
  return {
    id:                data.id,
    name:              data.name,
    username:          data.username,
    systemRole:        data.system_role,
    ownRoleId:         data.own_role_id,
    evaluableRoleIds:  data.evaluable_role_ids || [],
    active:            data.active,
    email:             authUser.email
  };
}

// ── Reprise de session ────────────────────────────────────────
export async function initAuth(onSuccess, onFail) {
  if(!_sbClient) { onFail(); return; }
  try {
    const { data: { session } } = await _sbClient.auth.getSession();
    if(session && session.user) {
      const profile = await loadProfile(session.user);
      if(profile && profile.active) {
        currentUser = profile;
        // Sync dans usersData local
        const idx = usersData.findIndex(u=>u.id===profile.id);
        if(idx>-1) usersData[idx]=profile; else usersData.unshift(profile);
        onSuccess(profile);
        return;
      }
    }
  } catch(e) { console.warn('initAuth error:', e); }
  onFail();
}

// ── Login Supabase Auth ───────────────────────────────────────
export async function doLogin(username, password, onSuccess, onError) {
  const un=(username||'').trim().toLowerCase();
  const pw=(password||'').trim();
  if(!un||!pw){onError('Veuillez remplir tous les champs.');return;}
  if(!_sbClient){onError('Connexion Supabase non disponible.');return;}

  // Construire l'email fictif
  const email = `${un}@hm-tarabet.local`;

  onError('⏳ Connexion en cours...');

  try {
    const { data, error } = await _sbClient.auth.signInWithPassword({
      email, password: pw
    });
    if(error) {
      // Fallback : essayer hash FNV-1a local (compatibilité)
      const hash = hashStr(pw);
      const localUser = usersData.find(u=>u.username===un&&u.passwordHash===hash&&u.active);
      if(localUser) { currentUser=localUser; onSuccess(localUser); return; }
      onError('Identifiant ou mot de passe incorrect.');
      return;
    }
    // Charger le profil depuis hm_profiles
    const profile = await loadProfile(data.user);
    if(!profile) { onError('Profil utilisateur introuvable.'); return; }
    if(!profile.active) { onError('Compte désactivé.'); return; }
    currentUser = profile;
    const idx = usersData.findIndex(u=>u.id===profile.id);
    if(idx>-1) usersData[idx]=profile; else usersData.unshift(profile);
    onSuccess(profile);
  } catch(e) {
    onError('Erreur de connexion : '+e.message);
  }
}

// ── Logout ────────────────────────────────────────────────────
export async function doLogout() {
  currentUser = null;
  if(_sbClient) await _sbClient.auth.signOut().catch(()=>{});
  sessionStorage.removeItem('hm_session');
}

// ── Créer un utilisateur (Directeur seulement) ────────────────
export async function createAuthUser(username, password, name, systemRole, ownRoleId, evaluableRoleIds) {
  if(!_sbClient) throw new Error('Supabase non connecté');
  const email = `${username.toLowerCase()}@hm-tarabet.local`;

  // Créer dans Supabase Auth via Admin API
  const { data, error } = await _sbClient.auth.admin?.createUser({
    email, password,
    email_confirm: true,
    user_metadata: { name, username }
  });

  // Fallback si admin API non disponible : signUp
  if(error || !data) {
    const { data: signUpData, error: signUpError } = await _sbClient.auth.signUp({
      email, password,
      options: { data: { name, username } }
    });
    if(signUpError) throw signUpError;
    if(!signUpData.user) throw new Error('Création échouée');

    // Insérer dans hm_profiles
    const { error: profileError } = await _sbClient.from('hm_profiles').insert({
      id: signUpData.user.id,
      username: username.toLowerCase(),
      name, system_role: systemRole,
      own_role_id: ownRoleId||null,
      evaluable_role_ids: evaluableRoleIds||[],
      active: true
    });
    if(profileError) throw profileError;
    return signUpData.user;
  }

  // Insérer dans hm_profiles
  const { error: profileError } = await _sbClient.from('hm_profiles').insert({
    id: data.user.id,
    username: username.toLowerCase(),
    name, system_role: systemRole,
    own_role_id: ownRoleId||null,
    evaluable_role_ids: evaluableRoleIds||[],
    active: true
  });
  if(profileError) throw profileError;
  return data.user;
}

// ── Changer mot de passe ──────────────────────────────────────
export async function changePassword(newPassword) {
  if(!_sbClient) throw new Error('Supabase non connecté');
  const { error } = await _sbClient.auth.updateUser({ password: newPassword });
  if(error) throw error;
}

// ── Toggle active ─────────────────────────────────────────────
export async function toggleProfileActive(userId) {
  if(!_sbClient) return;
  const profile = usersData.find(u=>u.id===userId);
  if(!profile) return;
  profile.active = !profile.active;
  await _sbClient.from('hm_profiles')
    .update({ active: profile.active })
    .eq('id', userId)
    .catch(()=>{});
  saveUsers();
}

// ── Charger tous les profils (Directeur) ──────────────────────
export async function loadAllProfiles() {
  if(!_sbClient) return [];
  const { data, error } = await _sbClient.from('hm_profiles').select('*');
  if(error || !data) return [];
  return data.map(p=>({
    id: p.id,
    name: p.name,
    username: p.username,
    systemRole: p.system_role,
    ownRoleId: p.own_role_id,
    evaluableRoleIds: p.evaluable_role_ids||[],
    active: p.active,
    passwordHash: null
  }));
}

// ── togglePwVis (UI helper) ───────────────────────────────────
export function togglePwVis(inputId, btn) {
  const el=document.getElementById(inputId); if(!el) return;
  if(el.type==='password'){el.type='text';btn.textContent='🙈';}
  else{el.type='password';btn.textContent='👁️';}
}
