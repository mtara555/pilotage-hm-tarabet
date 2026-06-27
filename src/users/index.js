import { usersData, currentUser, isDirecteur, hashStr,
         ROLE_COLORS, ROLE_LABELS, saveUsers } from '../auth/index.js';

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

export function toggleUserActive(userId) {
  const u=usersData.find(x=>x.id===userId); if(!u) return;
  u.active=!u.active; saveUsers(); renderUsersList();
  window.showToast&&window.showToast(u.active?'✅ Utilisateur réactivé':'Utilisateur désactivé',u.active?'#27ae60':'#e74c3c');
}

export function deleteUser(userId) {
  if(!confirm('Supprimer définitivement cet utilisateur ?')) return;
  const idx=usersData.findIndex(u=>u.id===userId); if(idx>-1) usersData.splice(idx,1);
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
    <label style="display:flex;align-items:center;gap:8px;padding:5px 0;font-size:12px;cursor:pointer;">
      <input type="checkbox" class="eval-chk" value="${r.id}" ${(existing?.evaluableRoleIds||[]).includes(r.id)?'checked':''}>
      <span>${r.icon}</span>${r.label}
    </label>`).join('');
  document.getElementById('modal-body').innerHTML=`
    <div style="display:flex;flex-direction:column;gap:12px;margin-top:8px;">
      <div class="modal-field"><label>Nom complet *</label>
        <input id="uf-name" type="text" value="${existing?.name||''}" placeholder="Prénom NOM" style="width:100%;padding:9px;border-radius:8px;border:1.5px solid var(--border);font-size:13px;"></div>
      <div class="modal-field"><label>Identifiant *</label>
        <input id="uf-username" type="text" value="${existing?.username||''}" placeholder="prenom.nom" style="width:100%;padding:9px;border-radius:8px;border:1.5px solid var(--border);font-size:13px;"></div>
      ${!existing?`
      <div class="modal-field"><label>Mot de passe *</label>
        <div style="position:relative;"><input type="password" id="uf-pw" placeholder="••••••••" style="width:100%;padding:9px;border-radius:8px;border:1.5px solid var(--border);font-size:13px;">
        <button onclick="window.togglePwVis('uf-pw',this)" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;">👁️</button></div></div>
      <div class="modal-field"><label>Confirmer *</label>
        <div style="position:relative;"><input type="password" id="uf-pw2" placeholder="••••••••" style="width:100%;padding:9px;border-radius:8px;border:1.5px solid var(--border);font-size:13px;">
        <button onclick="window.togglePwVis('uf-pw2',this)" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;">👁️</button></div></div>`:''}
      <div class="modal-field"><label>Rôle système *</label>
        <select id="uf-sysrole" onchange="window.onSysRoleChange(this.value)" style="width:100%;padding:9px;border-radius:8px;border:1.5px solid var(--border);font-size:13px;background:#fff;">${sysRoleOpts}</select></div>
      <div class="modal-field" id="uf-ownrole-field"><label>Fonction principale</label>
        <select id="uf-ownrole" style="width:100%;padding:9px;border-radius:8px;border:1.5px solid var(--border);font-size:13px;background:#fff;">${ownRoleOpts}</select></div>
      <div class="modal-field"><label>Fonctions évaluées</label>
        <div style="display:flex;gap:6px;margin-bottom:6px;">
          <button onclick="window.setAllEvalChk(true)" style="font-size:11px;padding:4px 10px;border-radius:6px;border:1px solid var(--border);cursor:pointer;">Tout</button>
          <button onclick="window.setAllEvalChk(false)" style="font-size:11px;padding:4px 10px;border-radius:6px;border:1px solid var(--border);cursor:pointer;">Aucun</button>
        </div>
        <div style="max-height:180px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:6px 10px;">${evalChkboxes}</div>
      </div>
    </div>`;
  document.getElementById('modal-save-btn').textContent=existing?'Enregistrer':'Créer';
  window._modalSaveCallback=()=>saveUserFromModal(userId, getAllRoles);
  document.getElementById('modal-overlay')?.classList.add('open');
  setTimeout(()=>document.getElementById('uf-name')?.focus(),100);
}

export function onSysRoleChange(val) {
  const f=document.getElementById('uf-ownrole-field'); if(f) f.style.display=val==='directeur'?'none':'block';
}
export function setAllEvalChk(v) { document.querySelectorAll('.eval-chk').forEach(c=>c.checked=v); }
export function setEvalChkBySysRole() {
  const sr=document.getElementById('uf-sysrole')?.value||'chef_rayon';
  document.querySelectorAll('.eval-chk').forEach(c=>{c.checked=false;});
}

export function saveUserFromModal(userId, getAllRoles) {
  const name=document.getElementById('uf-name').value.trim();
  const username=document.getElementById('uf-username').value.trim().toLowerCase();
  const sysRole=document.getElementById('uf-sysrole').value;
  const ownRoleId=document.getElementById('uf-ownrole')?.value||null;
  const evalIds=[...document.querySelectorAll('.eval-chk:checked')].map(c=>c.value);
  if(!name||!username){window.showToast&&window.showToast('Nom et identifiant requis','#e74c3c');return;}
  const conflict=usersData.find(u=>u.username===username&&u.id!==userId);
  if(conflict){window.showToast&&window.showToast('Cet identifiant est déjà utilisé','#e74c3c');return;}
  if(!userId){
    const pw=document.getElementById('uf-pw').value,pw2=document.getElementById('uf-pw2').value;
    if(!pw){window.showToast&&window.showToast('Mot de passe requis','#e74c3c');return;}
    if(pw!==pw2){window.showToast&&window.showToast('Les mots de passe ne correspondent pas','#e74c3c');return;}
    usersData.push({id:'u_'+Date.now(),name,username,passwordHash:hashStr(pw),systemRole:sysRole,ownRoleId:ownRoleId||null,evaluableRoleIds:evalIds,active:true,createdAt:new Date().toISOString()});
    window.showToast&&window.showToast(`✅ ${name} créé`,'#27ae60');
  } else {
    const u=usersData.find(x=>x.id===userId); if(!u) return;
    u.name=name;u.username=username;u.systemRole=sysRole;u.ownRoleId=ownRoleId||null;u.evaluableRoleIds=evalIds;
    window.showToast&&window.showToast(`✅ ${name} modifié`,'#27ae60');
  }
  saveUsers(); window.closeModal&&window.closeModal(); renderUsersList();
}

export function resetUserPw(userId) {
  const u=usersData.find(x=>x.id===userId); if(!u) return;
  document.getElementById('modal-title').textContent=`🔑 Réinitialiser — ${u.name}`;
  document.getElementById('modal-body').innerHTML=`
    <div class="modal-field"><label>Nouveau mot de passe</label>
      <input type="password" id="rpw-1" placeholder="••••••••" style="width:100%;padding:9px;border-radius:8px;border:1.5px solid var(--border);font-size:13px;"></div>
    <div class="modal-field"><label>Confirmer</label>
      <input type="password" id="rpw-2" placeholder="••••••••" style="width:100%;padding:9px;border-radius:8px;border:1.5px solid var(--border);font-size:13px;"></div>`;
  document.getElementById('modal-save-btn').textContent='Enregistrer';
  window._modalSaveCallback=()=>{
    const p1=document.getElementById('rpw-1').value,p2=document.getElementById('rpw-2').value;
    if(!p1){window.showToast&&window.showToast('Mot de passe requis','#e74c3c');return;}
    if(p1!==p2){window.showToast&&window.showToast('Les mots de passe ne correspondent pas','#e74c3c');return;}
    u.passwordHash=hashStr(p1);saveUsers();window.closeModal&&window.closeModal();
    window.showToast&&window.showToast('✅ Mot de passe modifié','#27ae60');
  };
  document.getElementById('modal-overlay')?.classList.add('open');
}
