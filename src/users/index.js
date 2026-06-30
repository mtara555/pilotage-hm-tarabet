// ══════════════════════════════════════════════════════════════
// users/index.js — Gestion utilisateurs via Edge Function
// Création sécurisée côté serveur (service_role key cachée)
// ══════════════════════════════════════════════════════════════
import { usersData, currentUser, isDirecteur, hashStr,
         ROLE_COLORS, ROLE_LABELS, saveUsers,
         loadAllProfiles, toggleProfileActive } from '../auth/index.js';
import { _sbClient } from '../services/supabase.js';

export function renderUsersList() {
  const el=document.getElementById('users-list'); if(!el) return;
  if(!usersData.length){el.innerHTML='<div style="color:var(--muted);font-size:13px;">Aucun utilisateur.</div>';return;}
  el.innerHTML=usersData.map(u=>`
    <div class="user-card${u.active?'':' inactive'}">
      <div class="user-avatar" style="background:${ROLE_COLORS[u.systemRole]||'#888'}">${(u.name||'?').charAt(0).toUpperCase()}</div>
      <div class="user-info">
        <div class="user-name">${u.name}</div>
        <div class="user-meta">@${u.username} · <span class="user-role-badge" style="background:${ROLE_COLORS[u.systemRole]||'#888'}22;color:${ROLE_COLORS[u.systemRole]||'#888'}">${ROLE_LABELS[u.systemRole]||u.systemRole}</span></div>
      </div>
      <div class="user-actions">
        ${u.username!=='admin'
          ?`<button class="user-btn" onclick="window.openEditUserModal('${u.id}')">✏️</button>
            <button class="user-btn" onclick="window.toggleUserActive('${u.id}')">${u.active?'⏸️':'▶️'}</button>
            <button class="user-btn danger" onclick="window.deleteUser('${u.id}')">🗑️</button>`
          :'<span style="font-size:11px;color:var(--muted);">Admin</span>'}
      </div>
    </div>`).join('');
}

export async function toggleUserActive(userId) {
  await toggleProfileActive(userId);
  renderUsersList();
  window.showToast&&window.showToast('✅ Statut modifié','#27ae60');
}

export async function deleteUser(userId) {
  if(!confirm('Supprimer définitivement cet utilisateur ?')) return;
  if(!_sbClient) return;
  // Supprimer le profil
  await _sbClient.from('hm_profiles').delete().eq('id',userId).catch(()=>{});
  const idx=usersData.findIndex(u=>u.id===userId);
  if(idx>-1) usersData.splice(idx,1);
  saveUsers(); renderUsersList();
  window.showToast&&window.showToast('Utilisateur supprimé');
}

export function openUserModal(userId, getAllRoles) {
  const existing=userId?usersData.find(u=>u.id===userId):null;
  const allRoles=getAllRoles?getAllRoles():[];
  document.getElementById('modal-title').textContent=existing?`✏️ Modifier — ${existing.name}`:'➕ Nouvel utilisateur';
  const sysRoleOpts=[
    {v:'directeur',l:'Directeur (Admin)'},
    {v:'chef_secteur',l:'Chef Secteur / Département'},
    {v:'chef_rayon',l:'Chef de Rayon'}
  ].map(o=>`<option value="${o.v}"${existing?.systemRole===o.v?' selected':''}>${o.l}</option>`).join('');
  const ownRoleOpts='<option value="">-- Aucun --</option>'+allRoles.map(r=>`<option value="${r.id}"${existing?.ownRoleId===r.id?' selected':''}>${r.icon} ${r.label}</option>`).join('');
  const evalChkboxes=allRoles.map(r=>`
    <label style="display:flex;align-items:flex-start;gap:8px;padding:7px 4px;font-size:12px;cursor:pointer;border-bottom:1px solid #f0f2f5;">
      <input type="checkbox" class="eval-chk" value="${r.id}" ${(existing?.evaluableRoleIds||[]).includes(r.id)?'checked':''}
        style="flex-shrink:0;margin-top:2px;width:16px;height:16px;cursor:pointer;">
      <span style="display:flex;align-items:center;gap:6px;line-height:1.3;">
        <span style="font-size:15px;flex-shrink:0;">${r.icon}</span>
        <span>${r.label}</span>
      </span>
    </label>`).join('');
  document.getElementById('modal-body').innerHTML=`
    <div style="display:flex;flex-direction:column;gap:12px;margin-top:8px;">
      <div class="modal-field"><label>Nom complet *</label>
        <input id="uf-name" type="text" value="${existing?.name||''}" placeholder="Prénom NOM"
          style="width:100%;padding:9px;border-radius:8px;border:1.5px solid var(--border);font-size:13px;box-sizing:border-box;"></div>
      <div class="modal-field"><label>Identifiant *</label>
        <input id="uf-username" type="text" value="${existing?.username||''}" placeholder="prenom.nom"
          style="width:100%;padding:9px;border-radius:8px;border:1.5px solid var(--border);font-size:13px;box-sizing:border-box;"
          ${existing?'readonly style="background:#f5f5f5;"':''}></div>
      ${!existing?`
      <div class="modal-field"><label>Mot de passe *</label>
        <div style="position:relative;display:flex;align-items:center;">
          <input type="password" id="uf-pw" placeholder="••••••••"
            style="width:100%;padding:9px;border-radius:8px;border:1.5px solid var(--border);font-size:13px;box-sizing:border-box;">
          <button onclick="window.togglePwVis('uf-pw',this)" style="position:absolute;right:8px;background:none;border:none;cursor:pointer;font-size:16px;">👁️</button>
        </div></div>
      <div class="modal-field"><label>Confirmer *</label>
        <div style="position:relative;display:flex;align-items:center;">
          <input type="password" id="uf-pw2" placeholder="••••••••"
            style="width:100%;padding:9px;border-radius:8px;border:1.5px solid var(--border);font-size:13px;box-sizing:border-box;">
          <button onclick="window.togglePwVis('uf-pw2',this)" style="position:absolute;right:8px;background:none;border:none;cursor:pointer;font-size:16px;">👁️</button>
        </div></div>`:''}
      <div class="modal-field"><label>Rôle système *</label>
        <select id="uf-sysrole" onchange="window.onSysRoleChange(this.value)"
          style="width:100%;padding:9px;border-radius:8px;border:1.5px solid var(--border);font-size:13px;background:#fff;">${sysRoleOpts}</select></div>
      <div class="modal-field" id="uf-ownrole-field"><label>Fonction principale</label>
        <select id="uf-ownrole"
          style="width:100%;padding:9px;border-radius:8px;border:1.5px solid var(--border);font-size:13px;background:#fff;">${ownRoleOpts}</select></div>
      <div class="modal-field"><label>Fonctions évaluées</label>
        <div style="display:flex;gap:6px;margin-bottom:6px;">
          <button onclick="window.setAllEvalChk(true)" style="font-size:11px;padding:4px 10px;border-radius:6px;border:1px solid var(--border);cursor:pointer;">Tout</button>
          <button onclick="window.setAllEvalChk(false)" style="font-size:11px;padding:4px 10px;border-radius:6px;border:1px solid var(--border);cursor:pointer;">Aucun</button>
        </div>
        <div style="max-height:180px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:6px 10px;">${evalChkboxes}</div>
      </div>
      <div id="uf-error" style="display:none;color:#e74c3c;font-size:12px;padding:8px;background:#fdecea;border-radius:8px;"></div>
    </div>`;
  document.getElementById('modal-save-btn').textContent=existing?'Enregistrer':'Créer';
  window._modalSaveCallback=()=>saveUserFromModal(userId, getAllRoles);
  document.getElementById('modal-overlay')?.classList.add('open');
  setTimeout(()=>document.getElementById('uf-name')?.focus(),100);
}

export function onSysRoleChange(val) {
  const f=document.getElementById('uf-ownrole-field');
  if(f) f.style.display=val==='directeur'?'none':'block';
}
export function setAllEvalChk(v) {
  document.querySelectorAll('.eval-chk').forEach(c=>c.checked=v);
}

export async function saveUserFromModal(userId, getAllRoles) {
  const name=document.getElementById('uf-name').value.trim();
  const username=document.getElementById('uf-username').value.trim().toLowerCase();
  const sysRole=document.getElementById('uf-sysrole').value;
  const ownRoleId=document.getElementById('uf-ownrole')?.value||null;
  const evalIds=[...document.querySelectorAll('.eval-chk:checked')].map(c=>c.value);
  const errEl=document.getElementById('uf-error');

  const showErr=(msg)=>{if(errEl){errEl.textContent=msg;errEl.style.display='block';}else window.showToast&&window.showToast(msg,'#e74c3c');};

  if(!name||!username){showErr('Nom et identifiant requis');return;}

  if(!userId) {
    // ── Création via Edge Function ────────────────────────────
    const pw=document.getElementById('uf-pw').value;
    const pw2=document.getElementById('uf-pw2').value;
    if(!pw){showErr('Mot de passe requis');return;}
    if(pw!==pw2){showErr('Les mots de passe ne correspondent pas');return;}
    if(pw.length<4){showErr('Mot de passe trop court (4 caractères minimum)');return;}

    const btn=document.getElementById('modal-save-btn');
    if(btn){btn.disabled=true;btn.textContent='⏳ Création...';}

    try {
      const { data: { session } } = await _sbClient.auth.getSession();
      const token = session?.access_token;
      if(!token) throw new Error('Non authentifié');

      const supabaseUrl = _sbClient.supabaseUrl || 
        document.querySelector('script[src*="supabase"]')?.src?.match(/https:\/\/[^/]+/)?.[0] ||
        'https://qpszmqkbhrqlycgdkgop.supabase.co';

      const res = await fetch(`${supabaseUrl}/functions/v1/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ username, password:pw, name, systemRole:sysRole, ownRoleId:ownRoleId||null, evaluableRoleIds:evalIds })
      });

      const result = await res.json();
      if(!res.ok || result.error) throw new Error(result.error||'Erreur création');

      // Recharger la liste des profils
      const { loadAllProfiles } = await import('../auth/index.js');
      const profiles = await loadAllProfiles();
      if(profiles.length>0) {
        const { setUsersData } = await import('../auth/index.js');
        setUsersData(profiles);
      }
      window.closeModal&&window.closeModal();
      renderUsersList();
      window.showToast&&window.showToast(`✅ ${name} créé avec succès`,'#27ae60');

    } catch(e) {
      showErr('❌ '+e.message);
      const btn=document.getElementById('modal-save-btn');
      if(btn){btn.disabled=false;btn.textContent='Créer';}
    }

  } else {
    // ── Modification du profil existant ──────────────────────
    if(!_sbClient) return;
    const { error } = await _sbClient.from('hm_profiles').update({
      name,
      system_role: sysRole,
      own_role_id: ownRoleId||null,
      evaluable_role_ids: evalIds
    }).eq('id', userId);

    if(error){showErr('❌ '+error.message);return;}

    const u=usersData.find(x=>x.id===userId);
    if(u){u.name=name;u.systemRole=sysRole;u.ownRoleId=ownRoleId||null;u.evaluableRoleIds=evalIds;}
    saveUsers(); window.closeModal&&window.closeModal(); renderUsersList();
    window.showToast&&window.showToast(`✅ ${name} modifié`,'#27ae60');
  }
}

export async function resetUserPw(userId) {
  const u=usersData.find(x=>x.id===userId); if(!u) return;
  document.getElementById('modal-title').textContent=`🔑 Réinitialiser — ${u.name}`;
  document.getElementById('modal-body').innerHTML=`
    <div class="modal-field"><label>Nouveau mot de passe</label>
      <input type="password" id="rpw-1" placeholder="••••••••"
        style="width:100%;padding:9px;border-radius:8px;border:1.5px solid var(--border);font-size:13px;box-sizing:border-box;"></div>
    <div class="modal-field"><label>Confirmer</label>
      <input type="password" id="rpw-2" placeholder="••••••••"
        style="width:100%;padding:9px;border-radius:8px;border:1.5px solid var(--border);font-size:13px;box-sizing:border-box;"></div>
    <div id="rpw-error" style="display:none;color:#e74c3c;font-size:12px;padding:8px;background:#fdecea;border-radius:8px;margin-top:8px;"></div>`;
  document.getElementById('modal-save-btn').textContent='Enregistrer';
  window._modalSaveCallback=async()=>{
    const p1=document.getElementById('rpw-1').value;
    const p2=document.getElementById('rpw-2').value;
    const errEl=document.getElementById('rpw-error');
    const showErr=(m)=>{if(errEl){errEl.textContent=m;errEl.style.display='block';}};
    if(!p1){showErr('Mot de passe requis');return;}
    if(p1!==p2){showErr('Les mots de passe ne correspondent pas');return;}
    if(!_sbClient){showErr('Non connecté');return;}
    // Utiliser Edge Function pour reset password
    try {
      const { data:{ session } } = await _sbClient.auth.getSession();
      const res = await fetch(`https://qpszmqkbhrqlycgdkgop.supabase.co/functions/v1/create-user`, {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${session?.access_token}`},
        body:JSON.stringify({action:'reset_password', userId, newPassword:p1})
      });
      const result=await res.json();
      if(!res.ok||result.error) throw new Error(result.error||'Erreur');
      window.closeModal&&window.closeModal();
      window.showToast&&window.showToast('✅ Mot de passe modifié','#27ae60');
    } catch(e){showErr('❌ '+e.message);}
  };
  document.getElementById('modal-overlay')?.classList.add('open');
}

export async function openChangePwModal() {
  if(!currentUser) return;
  document.getElementById('modal-title').textContent='🔑 Changer mon mot de passe';
  document.getElementById('modal-body').innerHTML=`
    <div class="modal-field"><label>Mot de passe actuel</label>
      <input type="password" id="cpw-0" placeholder="••••••••"
        style="width:100%;padding:9px;border-radius:8px;border:1.5px solid var(--border);font-size:13px;box-sizing:border-box;"></div>
    <div class="modal-field"><label>Nouveau mot de passe</label>
      <input type="password" id="cpw-1" placeholder="••••••••"
        style="width:100%;padding:9px;border-radius:8px;border:1.5px solid var(--border);font-size:13px;box-sizing:border-box;"></div>
    <div class="modal-field"><label>Confirmer</label>
      <input type="password" id="cpw-2" placeholder="••••••••"
        style="width:100%;padding:9px;border-radius:8px;border:1.5px solid var(--border);font-size:13px;box-sizing:border-box;"></div>
    <div id="cpw-error" style="display:none;color:#e74c3c;font-size:12px;padding:8px;background:#fdecea;border-radius:8px;margin-top:8px;"></div>`;
  document.getElementById('modal-save-btn').textContent='Changer';
  window._modalSaveCallback=async()=>{
    const p0=document.getElementById('cpw-0').value;
    const p1=document.getElementById('cpw-1').value;
    const p2=document.getElementById('cpw-2').value;
    const errEl=document.getElementById('cpw-error');
    const showErr=(m)=>{if(errEl){errEl.textContent=m;errEl.style.display='block';}};
    if(!p0||!p1){showErr('Tous les champs sont requis');return;}
    if(p1!==p2){showErr('Les mots de passe ne correspondent pas');return;}
    try {
      const { changePassword } = await import('../auth/index.js');
      await changePassword(p1);
      window.closeModal&&window.closeModal();
      window.showToast&&window.showToast('✅ Mot de passe changé','#27ae60');
    } catch(e){showErr('❌ '+e.message);}
  };
  document.getElementById('modal-overlay')?.classList.add('open');
}
