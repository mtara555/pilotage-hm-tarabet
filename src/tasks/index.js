import { _sb, _sbClient, _fbConnected } from '../services/supabase.js';
import { currentUser, isDirecteur } from '../auth/index.js';

export let completions   = {};
export let customTasks   = {};
export let completionLog = [];
export let taskOverrides = {};
export let taskNotes     = {};

export const TASK_NOTE_MAX_WORDS = 150;
export const TASK_FILE_MAX_BYTES = 2 * 1024 * 1024;

export const FC = { Q:'#e74c3c', H:'#f39c12', M:'#27ae60', T:'#8e44ad', A:'#2c3e50' };
export const FL = { Q:'Quotidien', H:'Hebdomadaire', M:'Mensuel', T:'Trimestriel', A:'Annuel' };

export function setCompletions(v)   { completions   = v; }
export function setCustomTasks(v)   { customTasks   = v; }
export function setCompletionLog(v) { completionLog = v; }
export function setTaskOverrides(v) { taskOverrides = v; }
export function setTaskNotes(v)     { taskNotes     = v; }

export function todayKey()   { return new Date().toISOString().slice(0,10); }
export function weekKey()    {
  const d=new Date(), j=new Date(d.getFullYear(),0,1);
  const w=Math.ceil(((d-j)/864e5+j.getDay()+1)/7);
  return `${d.getFullYear()}-W${String(w).padStart(2,'0')}`;
}
export function monthKey()   { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
export function quarterKey() { const d=new Date(); return `${d.getFullYear()}-T${Math.ceil((d.getMonth()+1)/3)}`; }
export function yearKey()    { return `${new Date().getFullYear()}`; }

export function periodKey(freq) {
  if(freq==='Q') return todayKey();
  if(freq==='H') return weekKey();
  if(freq==='M') return monthKey();
  if(freq==='T') return quarterKey();
  if(freq==='A') return yearKey();
  return monthKey();
}

export function weekKeyForDate(s) {
  const d=new Date(s+'T00:00:00'), day=d.getDay(), diff=day===0?-6:1-day;
  const mon=new Date(d); mon.setDate(d.getDate()+diff);
  const j=new Date(mon.getFullYear(),0,1);
  const w=Math.ceil(((mon-j)/864e5+j.getDay()+1)/7);
  return `${mon.getFullYear()}-W${String(w).padStart(2,'0')}`;
}
export function quarterKeyForDate(s) {
  const d=new Date(s+'T00:00:00');
  return `${d.getFullYear()}-T${Math.ceil((d.getMonth()+1)/3)}`;
}
export function periodKeyForDate(freq, dateStr) {
  if(freq==='Q') return dateStr;
  if(freq==='H') return weekKeyForDate(dateStr);
  if(freq==='M') return dateStr.slice(0,7);
  if(freq==='T') return quarterKeyForDate(dateStr);
  if(freq==='A') return dateStr.slice(0,4);
  return dateStr;
}

export function ck(rid, tid, freq) {
  const uid = currentUser ? currentUser.id : 'guest';
  return `${uid}__${rid}__${tid}__${periodKey(freq)}`;
}

export function isTaskDone(rid, tid, freq) {
  if(isDirecteur()) {
    const suffix='__'+rid+'__'+tid+'__'+periodKey(freq);
    return Object.keys(completions).some(k=>k.endsWith(suffix)&&completions[k]);
  }
  return !!completions[ck(rid,tid,freq)];
}

export function getTaskNote(rid, tid, freq) {
  if(isDirecteur()) {
    const suffix='__'+rid+'__'+tid+'__'+periodKey(freq);
    const k=Object.keys(taskNotes).find(key=>key.endsWith(suffix));
    return k ? taskNotes[k] : null;
  }
  return taskNotes[ck(rid,tid,freq)] || null;
}

export function getTaskNoteAny(rid, tid, freq) {
  const suffix='__'+rid+'__'+tid+'__'+periodKey(freq);
  const k=Object.keys(taskNotes).find(key=>key.endsWith(suffix));
  return k ? taskNotes[k] : null;
}

export function countWords(str) {
  return (str||'').trim().split(/\s+/).filter(Boolean).length;
}

export function deadlinePeriodInfo(deadline) {
  if(!deadline) return {emoji:'',label:''};
  const [h,m]=deadline.split(':').map(Number);
  return h<12||(h===12&&m===0) ? {emoji:'🌅',label:'Matin'} : {emoji:'🌙',label:'Soir'};
}

export function fmtDate(d) {
  const days=['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
  const months=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
export function fmtDateStr(s) { if(!s) return ''; const [y,m,d]=s.split('-'); return `${d}/${m}/${y}`; }
export function getWeekDates(s) {
  const d=new Date(s+'T00:00:00'),day=d.getDay(),diff=day===0?-6:1-day,mon=new Date(d);
  mon.setDate(d.getDate()+diff); const r=[];
  for(let i=0;i<7;i++){const x=new Date(mon);x.setDate(mon.getDate()+i);r.push(x.toISOString().slice(0,10));}
  return r;
}
export function getQuarterDates(s) {
  const d=new Date(s+'T00:00:00'),q=Math.ceil((d.getMonth()+1)/3),startMonth=(q-1)*3;
  const start=new Date(d.getFullYear(),startMonth,1),end=new Date(d.getFullYear(),startMonth+3,0);
  const r=[];
  for(let dt=new Date(start);dt<=end;dt.setDate(dt.getDate()+1)) r.push(dt.toISOString().slice(0,10));
  return r;
}
export function getYearDates(s) {
  const y=parseInt(s.slice(0,4)),r=[];
  for(let m=0;m<12;m++) r.push(`${y}-${String(m+1).padStart(2,'0')}`);
  return r;
}
export function saveData() {
  const uid=currentUser?currentUser.id:'guest';
  try {
    localStorage.setItem('hm_comp_'+uid,JSON.stringify(completions));
    localStorage.setItem('hm_comp',JSON.stringify(completions));
    localStorage.setItem('hm_cust',JSON.stringify(customTasks));
    localStorage.setItem('hm_log',JSON.stringify(completionLog));
    localStorage.setItem('hm_overrides',JSON.stringify(taskOverrides));
  } catch(e) {}
  if(_sbClient&&_fbConnected) {
    _sb.set('hm_completions',uid,completions).catch(()=>{});
    if(isDirecteur()) {
      _sb.set('hm_app_data','hm_custom_tasks',customTasks).catch(()=>{});
      _sb.set('hm_app_data','hm_task_overrides',taskOverrides).catch(()=>{});
    }
  }
}

export function saveTaskNotes() {
  try { localStorage.setItem('hm_task_notes',JSON.stringify(taskNotes)); } catch(e) {}
  if(_sbClient&&_fbConnected) _sb.set('hm_app_data','hm_task_notes',taskNotes).catch(()=>{});
}

export function purgeOldDailyCompletions(compObj) {
  const today=todayKey(); let n=0;
  Object.keys(compObj).forEach(k=>{
    const m=k.match(/__(\d{4}-\d{2}-\d{2})$/);
    if(m&&m[1]!==today){ delete compObj[k]; n++; }
  });
  return n;
}

export function toggleTask(rid, tid, freq, getAllTasksFn, onDone) {
  if(isDirecteur()) return {error:'Le Directeur suit les tâches, il ne les coche pas'};
  const taskForCheck=getAllTasksFn(rid).find(t=>t.id===tid);
  if(taskForCheck&&taskForCheck.deadline) {
    const now=new Date(); const hNow=now.getHours()*60+now.getMinutes();
    const [dh,dm]=taskForCheck.deadline.split(':').map(Number);
    const alreadyDone=!!completions[ck(rid,tid,freq)];
    if(!alreadyDone&&hNow>(dh*60+dm)) {
      const dpi=deadlinePeriodInfo(taskForCheck.deadline);
      return {error:`⛔ Hors délai — ${dpi.emoji} ${dpi.label} : validation avant ${taskForCheck.deadline} uniquement`};
    }
  }
  const key=ck(rid,tid,freq); const isDone=!completions[key];
  completions[key]=isDone;
  const task=getAllTasksFn(rid).find(t=>t.id===tid);
  const now=new Date();
  if(isDone&&task) {
    completionLog.push({
      roleId:rid, taskId:tid, taskLabel:task.label,
      freq, period:periodKey(freq),
      completedAt:now.toISOString(), userId:currentUser?.id
    });
    if(completionLog.length>5000) completionLog=completionLog.slice(-5000);
  } else {
    completionLog=completionLog.filter(e=>
      !(e.roleId===rid&&e.taskId===tid&&e.period===periodKey(freq)&&e.userId===currentUser?.id));
  }
  const uid=currentUser?currentUser.id:'guest';
  try {
    localStorage.setItem('hm_comp_'+uid,JSON.stringify(completions));
    localStorage.setItem('hm_comp',JSON.stringify(completions));
    localStorage.setItem('hm_log',JSON.stringify(completionLog));
  } catch(e) {}
  if(_sbClient&&_fbConnected) {
    _sb.set('hm_completions',uid,completions).catch(()=>{});
    _sb.get('hm_app_data','hm_history').then(hist=>{
      const archive=(hist&&typeof hist==='object')?hist:{};
      if(isDone) archive[key]=true; else delete archive[key];
      return _sb.set('hm_app_data','hm_history',archive);
    }).catch(()=>{});
  }
  onDone&&onDone({isDone,key});
  return {isDone};
}
