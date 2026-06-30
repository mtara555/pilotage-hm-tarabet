// ══════════════════════════════════════════════════════════════
// settings/modals.js — Modals Département & Rayon
// ══════════════════════════════════════════════════════════════
import { customRoles, customRayons, saveCustomRoles, saveRayons,
         renderCustomRolesList, renderRayonsList, renderSelectRayon,
         DEPT_ICONS, DEPT_COLORS } from './index.js';
import { usersData } from '../auth/index.js';

const SECTEURS = ['Commercial', 'Services', 'Permanence'];

// ── Modal Département ─────────────────────────────────────────
export function openAddDeptModal(editId) {
  const existing = editId ? customRoles.find(r => r.id === editId) : null;

  document.getElementById('modal-title').textContent = existing ? `✏️ Modifier — ${existing.label}` : '➕ Nouveau département';

  const iconsHtml = DEPT_ICONS.map(icon => `
    <button type="button" class="dept-icon-btn" data-icon="${icon}"
      style="font-size:22px;padding:8px;border-radius:8px;border:2px solid ${existing?.icon===icon?'var(--accent)':'#eee'};background:#fff;cursor:pointer;"
      onclick="window._selectDeptIcon('${icon}')">${icon}</button>
  `).join('');

  const colorsHtml = DEPT_COLORS.map(color => `
    <button type="button" class="dept-color-btn" data-color="${color}"
      style="width:32px;height:32px;border-radius:50%;background:${color};border:3px solid ${existing?.color===color?'#333':'#fff'};box-shadow:0 0 0 1px #ddd;cursor:pointer;"
      onclick="window._selectDeptColor('${color}')"></button>
  `).join('');

  const secteurOpts = SECTEURS.map(s => `<option value="${s}"${existing?.secteur===s?' selected':''}>${s}</option>`).join('');

  document.getElementById('modal-body').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px;margin-top:8px;">
      <div class="modal-field"><label>Nom du département *</label>
        <input id="dept-label" type="text" value="${existing?.label||''}" placeholder="Ex: Chef Département Électroménager"
          style="width:100%;padding:9px;border-radius:8px;border:1.5px solid var(--border);font-size:13px;box-sizing:border-box;"></div>

      <div class="modal-field"><label>Sous-titre</label>
        <input id="dept-sous" type="text" value="${existing?.sous||''}" placeholder="Ex: Électroménager & High-Tech"
          style="width:100%;padding:9px;border-radius:8px;border:1.5px solid var(--border);font-size:13px;box-sizing:border-box;"></div>

      <div class="modal-field"><label>Secteur *</label>
        <select id="dept-secteur" style="width:100%;padding:9px;border-radius:8px;border:1.5px solid var(--border);font-size:13px;background:#fff;">${secteurOpts}</select></div>

      <div class="modal-field"><label>Icône</label>
        <input type="hidden" id="dept-icon" value="${existing?.icon||DEPT_ICONS[0]}">
        <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px;max-height:130px;overflow-y:auto;">${iconsHtml}</div></div>

      <div class="modal-field"><label>Couleur</label>
        <input type="hidden" id="dept-color" value="${existing?.color||DEPT_COLORS[0]}">
        <div style="display:flex;gap:8px;flex-wrap:wrap;">${colorsHtml}</div></div>

      <div id="dept-error" style="display:none;color:#e74c3c;font-size:12px;padding:8px;background:#fdecea;border-radius:8px;"></div>
    </div>`;

  document.getElementById('modal-save-btn').textContent = existing ? 'Enregistrer' : 'Créer';
  window._modalSaveCallback = () => saveDeptFromModal(editId);
  document.getElementById('modal-overlay')?.classList.add('open');
  setTimeout(() => document.getElementById('dept-label')?.focus(), 100);
}

window._selectDeptIcon = function(icon) {
  document.getElementById('dept-icon').value = icon;
  document.querySelectorAll('.dept-icon-btn').forEach(b => {
    b.style.borderColor = b.dataset.icon === icon ? 'var(--accent)' : '#eee';
  });
};
window._selectDeptColor = function(color) {
  document.getElementById('dept-color').value = color;
  document.querySelectorAll('.dept-color-btn').forEach(b => {
    b.style.borderColor = b.dataset.color === color ? '#333' : '#fff';
  });
};

const LIGHT_MAP = {
  '#1a6b3c':'#e8f5ee','#2980b9':'#eaf4fb','#d35400':'#fdf0e8','#8e44ad':'#f5eef8',
  '#c0392b':'#fdecea','#27ae60':'#eafaf1','#e67e22':'#fef5e7','#16a085':'#e8f8f5',
  '#2c3e50':'#eaecee','#7f8c8d':'#f2f3f4'
};

function saveDeptFromModal(editId) {
  const label = (document.getElementById('dept-label')?.value || '').trim();
  const sous = (document.getElementById('dept-sous')?.value || '').trim();
  const secteur = document.getElementById('dept-secteur')?.value || 'Commercial';
  const icon = document.getElementById('dept-icon')?.value || '📋';
  const color = document.getElementById('dept-color')?.value || '#27ae60';
  const errEl = document.getElementById('dept-error');
  const showErr = (m) => { if(errEl){errEl.textContent=m;errEl.style.display='block';} };

  if (!label) { showErr('Le nom du département est requis'); return; }

  const light = LIGHT_MAP[color] || '#f0f0f0';

  if (editId) {
    const idx = customRoles.findIndex(r => r.id === editId);
    if (idx > -1) {
      customRoles[idx] = { ...customRoles[idx], label, sous, secteur, icon, color, light };
    }
  } else {
    const id = 'dept_' + Date.now();
    customRoles.push({ id, label, sous, secteur, icon, color, light, gere: [], rayons: [], taches: [] });
  }

  saveCustomRoles();
  window.closeModal && window.closeModal();
  renderCustomRolesList();
  window._renderDashboard && window._renderDashboard();
  window._renderSidebar && window._renderSidebar();
  window.showToast && window.showToast(editId ? '✅ Département modifié' : '✅ Département créé', '#27ae60');
}

export function deleteCustomRoleConfirm(id) {
  if (!confirm('Supprimer ce département ? Les tâches associées seront perdues.')) return;
  const idx = customRoles.findIndex(r => r.id === id);
  if (idx > -1) customRoles.splice(idx, 1);
  saveCustomRoles();
  renderCustomRolesList();
  window._renderDashboard && window._renderDashboard();
  window._renderSidebar && window._renderSidebar();
  window.showToast && window.showToast('Département supprimé', '#e74c3c');
}

// ── Modal Rayon ────────────────────────────────────────────────
const RAYON_ICONS = ['📦','🛒','🥖','🥩','🧀','🍷','🧴','👗','💊','🖥️','🔧','🌿','🍕','🐟','🧃'];

export function openRayonModal(editId) {
  const existing = editId ? customRayons[editId] : null;

  document.getElementById('modal-title').textContent = existing ? `✏️ Modifier — ${existing.label}` : '➕ Nouveau rayon';

  const activeUsers = usersData.filter(u => u.active);
  const chefOpts = '<option value="">-- Non assigné --</option>' +
    activeUsers.map(u => `<option value="${u.id}"${existing?.chefId===u.id?' selected':''}>${u.name}</option>`).join('');

  const iconsHtml = RAYON_ICONS.map(icon => `
    <button type="button" class="rayon-icon-btn" data-icon="${icon}"
      style="font-size:22px;padding:8px;border-radius:8px;border:2px solid ${existing?.icon===icon?'var(--accent)':'#eee'};background:#fff;cursor:pointer;"
      onclick="window._selectRayonIcon('${icon}')">${icon}</button>
  `).join('');

  document.getElementById('modal-body').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px;margin-top:8px;">
      <div class="modal-field"><label>Nom du rayon *</label>
        <input id="rayon-label" type="text" value="${existing?.label||''}" placeholder="Ex: Fruits & Légumes"
          style="width:100%;padding:9px;border-radius:8px;border:1.5px solid var(--border);font-size:13px;box-sizing:border-box;"></div>

      <div class="modal-field"><label>Chef de rayon assigné</label>
        <select id="rayon-chef" style="width:100%;padding:9px;border-radius:8px;border:1.5px solid var(--border);font-size:13px;background:#fff;">${chefOpts}</select></div>

      <div class="modal-field"><label>Icône</label>
        <input type="hidden" id="rayon-icon" value="${existing?.icon||RAYON_ICONS[0]}">
        <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px;">${iconsHtml}</div></div>

      <div class="modal-field"><label>Couleur</label>
        <input type="color" id="rayon-color" value="${existing?.color||'#27ae60'}"
          style="width:100%;height:40px;border-radius:8px;border:1.5px solid var(--border);cursor:pointer;"></div>

      <div id="rayon-error" style="display:none;color:#e74c3c;font-size:12px;padding:8px;background:#fdecea;border-radius:8px;"></div>
    </div>`;

  document.getElementById('modal-save-btn').textContent = existing ? 'Enregistrer' : 'Créer';
  window._modalSaveCallback = () => saveRayonFromModal(editId);
  document.getElementById('modal-overlay')?.classList.add('open');
  setTimeout(() => document.getElementById('rayon-label')?.focus(), 100);
}

window._selectRayonIcon = function(icon) {
  document.getElementById('rayon-icon').value = icon;
  document.querySelectorAll('.rayon-icon-btn').forEach(b => {
    b.style.borderColor = b.dataset.icon === icon ? 'var(--accent)' : '#eee';
  });
};

function saveRayonFromModal(editId) {
  const label = (document.getElementById('rayon-label')?.value || '').trim();
  const chefId = document.getElementById('rayon-chef')?.value || '';
  const icon = document.getElementById('rayon-icon')?.value || '📦';
  const color = document.getElementById('rayon-color')?.value || '#27ae60';
  const errEl = document.getElementById('rayon-error');
  const showErr = (m) => { if(errEl){errEl.textContent=m;errEl.style.display='block';} };

  if (!label) { showErr('Le nom du rayon est requis'); return; }

  const chefUser = chefId ? usersData.find(u => u.id === chefId) : null;

  const id = editId || ('rayon_' + Date.now());
  customRayons[id] = {
    label, icon, color,
    chefId: chefId || null,
    chefName: chefUser ? chefUser.name : '',
    taches: customRayons[id]?.taches || []
  };

  saveRayons();
  window.closeModal && window.closeModal();
  renderRayonsList();
  renderSelectRayon();
  window.showToast && window.showToast(editId ? '✅ Rayon modifié' : '✅ Rayon créé', '#27ae60');
}

export function deleteRayonConfirm(id) {
  if (!confirm('Supprimer ce rayon ?')) return;
  delete customRayons[id];
  saveRayons();
  renderRayonsList();
  renderSelectRayon();
  window.showToast && window.showToast('Rayon supprimé', '#e74c3c');
}
