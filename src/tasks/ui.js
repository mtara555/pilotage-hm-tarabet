import { currentUser, usersData, isDirecteur, canEditRole } from '../auth/index.js';
import { completions, customTasks, completionLog, taskNotes,
         FC, FL, isTaskDone, getTaskNote, ck, periodKey,
         deadlinePeriodInfo, countWords, TASK_NOTE_MAX_WORDS, TASK_FILE_MAX_BYTES,
         saveData, saveTaskNotes } from './index.js';

export let _modalNoteRoleId=null, _modalNoteTaskId=null, _modalNoteFreq=null;
let _pendingNoteFile=undefined;

export function renderTasks(currentRoleId, getRole, getAllTasks) {
  const r=getRole(currentRoleId); if(!r) return;
  const currentFreq=window._currentFreq||'ALL';
  const tasks=getAllTasks(currentRoleId).filter(t=>currentFreq==='ALL'||t.freq===currentFreq);
  const canEdit=canEditRole(currentRoleId);
  const isAdmin=isDirecteur();
  const tl=document.getElementById('task-list');
  if(!tasks.length){tl.innerHTML=`<div style="text-align:center;padding:40px;color:var(--muted);">Aucune tâche pour ce filtre.</div>`;return;}
  const now=new Date(); const hNow=now.getHours()*60+now.getMinutes();
  tl.innerHTML=tasks.map(t=>{
    const done=isTaskDone(currentRoleId,t.id,t.freq);
    const isCust=t.id.startsWith('c_');
    const completionEntry=isAdmin
      ? completionLog.find(e=>e.taskId===t.id&&e.roleId===currentRoleId&&e.period===periodKey(t.freq))
      : completionLog.find(e=>e.taskId===t.id&&e.roleId===currentRoleId&&e.period===periodKey(t.freq)&&e.userId===currentUser?.id);
    let deadlineIndicator='';
    if(t.deadline){
      const [dh,dm]=t.deadline.split(':').map(Number);
      const deadlineMin=dh*60+dm;
      const dpi=deadlinePeriodInfo(t.deadline);
      const labelH=`${dpi.emoji} ${dpi.label}`;
      if(done&&completionEntry){
        const doneAt=new Date(completionEntry.completedAt);
        const onTime=doneAt.getHours()*60+doneAt.getMinutes()<=deadlineMin;
        const doneTimeStr=doneAt.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
        const who=isAdmin?(usersData.find(u=>u.id===completionEntry.userId)?.name||''):'';
        deadlineIndicator=`<span style="font-size:11px;font-weight:700;padding:3px 9px;border-radius:10px;background:${onTime?'#eafaf1':'#fdecea'};color:${onTime?'#27ae60':'#e74c3c'}">${onTime?'🟢':'🔴'} ${labelH} · ${doneTimeStr}${isAdmin&&who?' · '+who:''}</span>`;
      } else {
        const enRetard=hNow>deadlineMin;
        deadlineIndicator=`<span style="font-size:11px;font-weight:700;padding:3px 9px;border-radius:10px;background:${enRetard?'#fdecea':'#fef9f0'};color:${enRetard?'#e74c3c':'#e67e22'}">${enRetard?'🔴':'⏳'} ${labelH} · avant ${t.deadline}</span>`;
      }
    }
    const note=getTaskNote(currentRoleId,t.id,t.freq);
    const noteAuthor=note?(usersData.find(u=>u.id===note.userId)?.name||''):'';
    let commentHtml='';
    if(note&&note.comment) commentHtml=`<div class="task-comment-display">💬 ${isAdmin&&noteAuthor?`<span class="tc-who">${noteAuthor} :</span>`:''}${note.comment.replace(/</g,'&lt;')}</div>`;
    let attachHtml='';
    if(note&&note.fileData){
      const isImg=(note.fileType||'').startsWith('image/');
      const sizeKb=note.fileSize?Math.round(note.fileSize/1024)+' Ko':'';
      attachHtml=isImg
        ?`<div class="task-attach-display"><a href="${note.fileData}" target="_blank" onclick="event.stopPropagation()"><img src="${note.fileData}" style="max-width:100%;max-height:80px;border-radius:6px;"></a></div>`
        :`<div class="task-attach-display"><a href="${note.fileData}" download onclick="event.stopPropagation()">📎 ${note.fileName||'fichier'} ${sizeKb}</a></div>`;
    }
    const noteBtn=(canEdit&&!isAdmin)?`<button class="task-note-btn${note?' has-note':''}" onclick="event.stopPropagation();window.openTaskNoteModal('${t.id}','${t.freq}')" title="Commentaire">💬</button>`:'';
    const clickHandler=(canEdit&&!isAdmin)?`onclick="window.handleToggleTask('${t.id}','${t.freq}')"` :'';
    const itemStyle=done?`background:${r.light};border-color:${r.color}22`:'';
    const checkStyle=done?`background:${r.color};border-color:${r.color}`:'';
    return `<div class="task-item${done?' done-item':''}${!canEdit?' read-only':''}" ${clickHandler} style="${itemStyle}" id="ti_${t.id}">
      <div class="task-check" style="${checkStyle}${(!canEdit||isAdmin)?';opacity:0.4;cursor:default':''}">${done?'✓':''}</div>
      <div class="task-body" style="flex:1;">
        <div class="task-top"><span class="task-label">${t.label}</span>
          <span class="fbadge" style="background:${FC[t.freq]}18;color:${FC[t.freq]}">${FL[t.freq]}</span>
          ${isCust?`<span class="cbadge">Personnalisé</span>`:''}
        </div>
        ${t.note?`<div class="task-note">${t.note}</div>`:''}
        ${deadlineIndicator?`<div style="margin-top:5px;">${deadlineIndicator}</div>`:''}
        ${commentHtml}${attachHtml}
      </div>
      ${noteBtn}
      ${isCust&&isAdmin?`<button class="task-edit-btn" onclick="event.stopPropagation();window.editCustomTask('${t.id}')">✏️</button><button class="task-del" onclick="event.stopPropagation();window.delCustom('${t.id}')">✕</button>`:''}
    </div>`;
  }).join('');
}

export function renderRoleHeader(currentRoleId, getRole, getRoleStats) {
  const r=getRole(currentRoleId); const s=getRoleStats(currentRoleId);
  const circ=2*Math.PI*26; const dash=circ*(1-s.pct/100);
  const rh=document.getElementById('role-header'); rh.style.borderColor=r.color+'28';
  rh.innerHTML=`<div class="rh-icon">${r.icon}</div>
    <div class="rh-body"><h2 style="color:${r.color}">${r.label}</h2><div class="rh-sous">${r.sous}</div>
    ${r.gere&&r.gere.length?`<div class="gere-tags">${r.gere.map(g=>`<span class="gtag" style="background:${r.light};color:${r.color}">${g}</span>`).join('')}</div>`:''}
    </div>
    <div id="donut-wrap"><svg width="62" height="62" viewBox="0 0 62 62" style="transform:rotate(-90deg)">
      <circle cx="31" cy="31" r="26" fill="none" stroke="#eef0f4" stroke-width="8"/>
      <circle cx="31" cy="31" r="26" fill="none" stroke="${r.color}" stroke-width="8" stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${dash.toFixed(1)}" stroke-linecap="round"/>
      <text x="31" y="36" text-anchor="middle" font-family="DM Mono,monospace" font-size="11" font-weight="900" fill="${r.color}" transform="rotate(90,31,31)">${s.pct}%</text>
    </svg><div class="donut-lbl">${s.done}/${s.total}</div></div>`;
}

export function renderProgressBar(currentRoleId, getRole, getAllTasks) {
  const r=getRole(currentRoleId); const currentFreq=window._currentFreq||'ALL';
  const tasks=getAllTasks(currentRoleId).filter(t=>currentFreq==='ALL'||t.freq===currentFreq);
  const done=tasks.filter(t=>isTaskDone(currentRoleId,t.id,t.freq)).length;
  const pct=tasks.length?Math.round(done/tasks.length*100):0;
  const pb=document.getElementById('progress-bar'); if(pb){pb.style.width=pct+'%';pb.style.background=r.color;}
  const pc=document.getElementById('pb-count'); if(pc){pc.textContent=`${done}/${tasks.length} (${pct}%)`;pc.style.color=r.color;}
}

export function openTaskNoteModal(taskId, freq, currentRoleId, getTaskNoteFn) {
  _modalNoteRoleId=currentRoleId; _modalNoteTaskId=taskId; _modalNoteFreq=freq; _pendingNoteFile=undefined;
  const existing=getTaskNoteFn(currentRoleId,taskId,freq);
  document.getElementById('modal-title').textContent='💬 Commentaire & pièce jointe';
  document.getElementById('modal-body').innerHTML=`
    <div class="modal-field"><label>Commentaire (${TASK_NOTE_MAX_WORDS} mots max)</label>
      <textarea id="note-comment" rows="4" style="width:100%;padding:9px 12px;border-radius:8px;border:1.5px solid var(--border);font-size:13px;resize:vertical;font-family:inherit;" oninput="window.updateNoteWordCount()">${(existing&&existing.comment)?existing.comment.replace(/</g,'&lt;'):''}</textarea>
      <div id="note-word-count" style="font-size:11px;color:var(--muted);margin-top:4px;">0 / ${TASK_NOTE_MAX_WORDS} mots</div>
    </div>
    <div class="modal-field"><label>Pièce jointe (2 Mo max)</label>
      <input type="file" id="note-file-input" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onchange="window.handleNoteFileChange(event)" style="width:100%;font-size:12px;">
      <div id="note-file-preview"></div>
    </div>`;
  window._modalSaveCallback=()=>_saveTaskNote(currentRoleId,taskId,freq);
  document.getElementById('modal-overlay')?.classList.add('open');
  window.updateNoteWordCount&&window.updateNoteWordCount();
}

export function updateNoteWordCount() {
  const ta=document.getElementById('note-comment'); if(!ta) return;
  const w=countWords(ta.value);
  const el=document.getElementById('note-word-count'); if(!el) return;
  el.textContent=`${w} / ${TASK_NOTE_MAX_WORDS} mots`;
  el.style.color=w>TASK_NOTE_MAX_WORDS?'#e74c3c':'var(--muted)';
}

export function handleNoteFileChange(e) {
  const file=e.target.files[0]; if(!file) return;
  if(file.size>TASK_FILE_MAX_BYTES){window.showToast&&window.showToast('❌ Fichier trop lourd (max 2 Mo)','#e74c3c');e.target.value='';return;}
  const reader=new FileReader();
  reader.onload=ev=>{
    _pendingNoteFile={fileName:file.name,fileType:file.type,fileSize:file.size,fileData:ev.target.result};
    const el=document.getElementById('note-file-preview'); if(!el) return;
    const isImg=file.type.startsWith('image/');
    el.innerHTML=isImg
      ?`<img src="${ev.target.result}" style="max-width:100%;max-height:120px;border-radius:8px;margin-top:8px;">`
      :`<div style="margin-top:8px;font-size:12px;background:#f0f4ff;padding:7px 10px;border-radius:8px;">📎 ${file.name}</div>`;
  };
  reader.readAsDataURL(file);
}

export function removeNoteFile() {
  _pendingNoteFile=null;
  const el=document.getElementById('note-file-preview'); if(el) el.innerHTML='';
  const fi=document.getElementById('note-file-input'); if(fi) fi.value='';
}

function _saveTaskNote(rid, tid, freq) {
  const comment=(document.getElementById('note-comment')?.value||'').trim();
  const wc=countWords(comment);
  if(wc>TASK_NOTE_MAX_WORDS){window.showToast&&window.showToast(`⚠️ Commentaire trop long : ${wc}/${TASK_NOTE_MAX_WORDS} mots`,'#e74c3c');return;}
  const key=ck(rid,tid,freq);
  const existing=taskNotes[key]||{};
  let {fileData,fileName,fileType,fileSize}=existing;
  if(_pendingNoteFile===null){fileData=null;fileName=null;fileType=null;fileSize=null;}
  else if(_pendingNoteFile?.fileData){fileData=_pendingNoteFile.fileData;fileName=_pendingNoteFile.fileName;fileType=_pendingNoteFile.fileType;fileSize=_pendingNoteFile.fileSize;}
  if(!comment&&!fileData){delete taskNotes[key];}
  else{taskNotes[key]={comment,fileName,fileType,fileSize,fileData,userId:currentUser?.id,userName:currentUser?.name,updatedAt:new Date().toISOString()};}
  saveTaskNotes();
  window.closeModal&&window.closeModal();
  window.showToast&&window.showToast('💬 Commentaire enregistré','#27ae60');
  window._rerenderTasks&&window._rerenderTasks();
}
