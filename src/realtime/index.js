import { _sb, _sbClient, _fbConnected } from '../services/supabase.js';
import { currentUser, isDirecteur, usersData } from '../auth/index.js';
import { completions, setCompletions, setCustomTasks,
         setTaskOverrides, setTaskNotes, todayKey } from '../tasks/index.js';
import { companyData, customRoles, customRayons,
         setCompanyData, setCustomRoles, setCustomRayons,
         updateHeaderCompany, renderRayonsList,
         renderSelectRayon, renderCustomRolesList } from '../settings/index.js';

export let _eventsCache = {};
let _pollInterval = null;

export function pushTaskEventToAdmin(tid, freq, isDone, task, role, periodKeyFn) {
  if(!_sbClient||!_fbConnected) return;
  const uid=currentUser?currentUser.id:'guest';
  const now=new Date();
  const heure=now.getHours()*60+now.getMinutes();
  const deadline=12*60;
  const statut=isDone?(heure<deadline?'VERT':'ROUGE'):'ANNULE';
  const couleur=isDone?(heure<deadline?'#27ae60':'#e74c3c'):'#888';
  const event={
    uid, userName:currentUser?.name||'?',
    roleId:role.id, roleLabel:role.label, roleIcon:role.icon, secteur:role.secteur,
    taskId:tid, taskLabel:task?task.label:'?',
    freq, isDone, statut, couleur,
    heure:now.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}),
    completedAt:now.toISOString(),
    period:periodKeyFn(freq)
  };
  const eventKey=uid+'__'+role.id+'__'+tid+'__'+periodKeyFn(freq);
  if(isDone) {
    _sbClient.from('hm_events').upsert({id:eventKey,data:event}).catch(()=>{});
  } else {
    _sbClient.from('hm_events').delete().eq('id',eventKey).catch(()=>{});
  }
}

export function setupRealtimeListeners(callbacks) {
  const {onCompletionsChanged, onEventsChanged, onAppDataChanged} = callbacks;

  _sb.on('hm_completions', async(payload)=>{
    const changedUid=payload.new?.user_id||payload.old?.user_id;
    const today=todayKey();
    function filterToday(data){
      const f={}; Object.keys(data).forEach(k=>{
        const m=k.match(/__(\d{4}-\d{2}-\d{2})$/);
        if(!m||m[1]===today) f[k]=data[k];
      }); return f;
    }
    if(isDirecteur()) {
      const rows=await _sb.getAll('hm_completions').catch(()=>[]);
      if(rows&&rows.length>0){
        let merged={};
        rows.forEach(r=>{if(r.data&&typeof r.data==='object') Object.assign(merged,r.data);});
        merged=filterToday(merged);
        Object.keys(merged).forEach(k=>{if(merged[k]) completions[k]=merged[k];});
      }
      onCompletionsChanged&&onCompletionsChanged();
    } else if(currentUser&&changedUid===currentUser.id) {
      const myComp=await _sb.get('hm_completions',currentUser.id).catch(()=>null);
      if(myComp&&typeof myComp==='object'){
        setCompletions(filterToday(myComp));
        onCompletionsChanged&&onCompletionsChanged();
      }
    }
  });

  _sb.on('hm_events', async()=>{
    if(!isDirecteur()) return;
    const rows=await _sbClient.from('hm_events').select('id,data').catch(()=>({data:[]}));
    const evts={};
    (rows.data||[]).forEach(r=>{if(r.data) evts[r.id]=r.data;});
    _eventsCache=evts;
    onEventsChanged&&onEventsChanged(evts);
  });

  _sb.on('hm_app_data', async(payload)=>{
    const key=payload.new?.key||payload.old?.key; if(!key) return;
    const fresh=await _sb.get('hm_app_data',key).catch(()=>null);
    if(fresh===null) return;
    onAppDataChanged&&onAppDataChanged(key,fresh);
  });
}

export function startSupabasePoll(onPoll) {
  if(_pollInterval) clearInterval(_pollInterval);
  _pollInterval=setInterval(async()=>{
    if(!_sbClient||!_fbConnected||!currentUser) return;
    onPoll&&onPoll();
  }, 30000);
}
