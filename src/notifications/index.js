import { currentUser, isDirecteur, canEditRole } from '../auth/index.js';
import { isTaskDone, deadlinePeriodInfo, todayKey } from '../tasks/index.js';

let _notifSentKeys = new Set();

export function resetNotifSentKeys() { _notifSentKeys.clear(); }

export function requestNotifPermission() {
  if(!('Notification' in window)){window.showToast&&window.showToast('🔕 Notifications non supportées','#e74c3c');return;}
  if(Notification.permission==='granted'){window.showToast&&window.showToast('🔔 Notifications déjà activées','#27ae60');updateNotifBtnState();return;}
  if(Notification.permission==='denied'){window.showToast&&window.showToast('🔕 Notifications bloquées','#e74c3c');updateNotifBtnState();return;}
  Notification.requestPermission().then(p=>{
    if(p==='granted') window.showToast&&window.showToast('🔔 Notifications activées','#27ae60');
    else if(p==='denied') window.showToast&&window.showToast('🔕 Notifications refusées','#e74c3c');
    updateNotifBtnState();
  });
}

export function updateNotifBtnState() {
  const btn=document.getElementById('um-notif-btn'); if(!btn) return;
  if(!('Notification' in window)){btn.textContent='🔕 Non supportées';btn.disabled=true;return;}
  btn.disabled=false;
  if(Notification.permission==='granted'){btn.textContent='🔔 Notifications activées ✓';btn.style.color='#27ae60';}
  else if(Notification.permission==='denied'){btn.textContent='🔕 Notifications bloquées';btn.style.color='#e74c3c';}
  else{btn.textContent='🔔 Activer les notifications';btn.style.color='';}
}

export function sendNotif(title, body, icon, tag) {
  if(!('Notification' in window)||Notification.permission!=='granted') return;
  try {
    const n=new Notification(title,{
      body, icon:icon||'./icon-192.png',
      tag:tag||('hm-'+Date.now()),
      requireInteraction:false
    });
    n.onclick=()=>{window.focus();n.close();};
    setTimeout(()=>n.close(),8000);
  } catch(e) {}
}

export function _getSeenNewTasks() {
  try{return new Set(JSON.parse(localStorage.getItem('hm_notif_new_tasks')||'[]'));}catch(e){return new Set();}
}
export function _markNewTaskSeen(taskId) {
  const s=_getSeenNewTasks(); s.add(taskId);
  try{localStorage.setItem('hm_notif_new_tasks',JSON.stringify([...s]));}catch(e){}
}

export function checkUpcomingTaskNotifs(getAllRoles, getAllTasks, customTasks) {
  if(!currentUser||isDirecteur()) return;
  if(Notification.permission!=='granted') return;
  const uid=currentUser.id, now=new Date();
  const nowMin=now.getHours()*60+now.getMinutes();
  const todayStr=todayKey();
  const todayDay=['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'][now.getDay()];
  const todayDate=now.getDate();
  const seenNewTasks=_getSeenNewTasks();

  getAllRoles().forEach(r=>{
    if(!canEditRole(r.id)&&currentUser.ownRoleId!==r.id) return;
    const customForRole=(customTasks&&customTasks[r.id])||[];
    customForRole.forEach(t=>{
      const isForMe=!t.assignedTo||t.assignedTo===''||t.assignedTo===uid;
      if(isForMe&&t.createdBy&&t.createdBy!==uid&&!seenNewTasks.has(t.id)){
        const createdAgo=t.createdAt?(Date.now()-new Date(t.createdAt).getTime()):999999999;
        if(createdAgo<3600000){
          _markNewTaskSeen(t.id);
          sendNotif('📋 Nouvelle tâche assignée',`${r.icon} ${r.label}\n📝 ${t.label}`,null,'new-task-'+t.id);
        }
      }
      if(!t.deadline||!isForMe) return;
      if(t.freq==='H'&&t.jours&&t.jours.length>0&&!t.jours.includes(todayDay)) return;
      if(t.freq==='M'&&t.datesMois&&t.datesMois.length>0&&!t.datesMois.map(Number).includes(todayDate)) return;
      if(isTaskDone(r.id,t.id,t.freq)) return;
      const [dh,dm]=t.deadline.split(':').map(Number);
      const diff=(dh*60+dm)-nowMin;
      if(diff>=4&&diff<=6){
        const notifKey=`${uid}__${r.id}__${t.id}__${todayStr}__remind`;
        if(_notifSentKeys.has(notifKey)) return;
        _notifSentKeys.add(notifKey);
        sendNotif('⏰ Rappel — 5 min avant la deadline',`${r.icon} ${r.label}\n📋 ${t.label}\n🕐 Avant ${t.deadline}`,null,notifKey);
        window.showToast&&window.showToast(`⏰ Rappel : "${t.label}" — avant ${t.deadline}`,'#f39c12');
      }
    });
  });
}

export function notifyAdminTaskDone(taskLabel, userName, roleLabel, roleIcon, isDone) {
  if(!isDirecteur()) return;
  if(!('Notification' in window)) return;
  if(Notification.permission==='default'){
    Notification.requestPermission().then(p=>{
      if(p==='granted') _doNotifyAdminTaskDone(taskLabel,userName,roleLabel,roleIcon,isDone);
    }); return;
  }
  if(Notification.permission!=='granted') return;
  _doNotifyAdminTaskDone(taskLabel,userName,roleLabel,roleIcon,isDone);
}

export function _doNotifyAdminTaskDone(taskLabel, userName, roleLabel, roleIcon, isDone) {
  if(!isDone) return;
  const heureStr=new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  const dedupKey=`admin-done-${userName}-${taskLabel}`;
  if(_notifSentKeys.has(dedupKey)) return;
  _notifSentKeys.add(dedupKey);
  setTimeout(()=>_notifSentKeys.delete(dedupKey),30000);
  sendNotif(`✅ Tâche effectuée — ${heureStr}`,`${roleIcon||'📋'} ${roleLabel}\n👤 ${userName}\n📋 ${taskLabel}`,null,'admin-task-'+Date.now());
}
