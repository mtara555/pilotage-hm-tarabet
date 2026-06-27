import { getAllRoles, getAllTasks } from '../app.js';
import { companyData } from '../settings/index.js';
import { fmtDate, fmtDateStr, getTaskNoteAny,
         FL, FC } from '../tasks/index.js';
import { isTaskDoneForDateHist } from './results.js';

let scopeSet = new Set(['ALL']);
export function getScopeSet() { return scopeSet; }

export function renderExportScope() {
  const container=document.getElementById('scope-container'); if(!container) return;
  const allRoles=getAllRoles();
  container.innerHTML=`<div class="scope-grid">
    <button class="scope-btn${scopeSet.has('ALL')?' active':''}" onclick="window.toggleScope('ALL')">🏬 Tous les départements</button>
    ${allRoles.map(r=>`<button class="scope-btn${scopeSet.has(r.id)?' active':''}" onclick="window.toggleScope('${r.id}')">${r.icon} ${r.label}</button>`).join('')}
  </div>`;
}

export function toggleScope(id) {
  if(id==='ALL'){scopeSet=new Set(['ALL']);}
  else{scopeSet.delete('ALL');if(scopeSet.has(id))scopeSet.delete(id);else scopeSet.add(id);}
  renderExportScope();
}

export function generateReportHTML(dateFrom, dateTo, histComp) {
  const roles=scopeSet.has('ALL')?getAllRoles():getAllRoles().filter(r=>scopeSet.has(r.id));
  let html=`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
    <style>
      body{font-family:'DM Sans',Arial,sans-serif;font-size:12px;color:#1a1f2e;margin:0;padding:20px;}
      .report-header{background:linear-gradient(135deg,#0a1628,#102244);color:#fff;padding:20px;border-radius:8px;margin-bottom:20px;}
      .rh-company{font-size:18px;font-weight:900;margin-bottom:4px;}
      .rh-sub{font-size:11px;opacity:.7;}
      .role-section{margin-bottom:18px;border:1px solid #e0e4ea;border-radius:8px;overflow:hidden;}
      .role-section-head{background:#f8f9fb;padding:10px 14px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #e0e4ea;}
      .rs-icon{font-size:20px;} .rs-name{font-size:13px;font-weight:800;flex:1;}
      .rs-pct{font-size:14px;font-weight:900;}
      table{width:100%;border-collapse:collapse;}
      td,th{padding:7px 12px;text-align:left;font-size:11px;border-bottom:1px solid #f0f2f5;}
      th{font-weight:700;color:#666;background:#fafbfc;font-size:10px;text-transform:uppercase;}
      .done-row td{color:#27ae60;} .undone-row td{color:#555;}
      .task-freq{font-size:9px;padding:2px 6px;border-radius:5px;font-weight:700;}
      .report-comment{font-size:10.5px;color:#5b4b73;background:#f7f1fb;border-radius:5px;padding:4px 7px;margin-top:4px;}
      @media print{body{padding:0;}.role-section{break-inside:avoid;}}
    </style></head><body>
    <div class="report-header">
      ${companyData.logo?`<img src="${companyData.logo}" style="height:40px;border-radius:6px;margin-bottom:8px;">`:''}
      <div class="rh-company">${companyData.nom||'Rapport de Pilotage'}</div>
      <div class="rh-sub">Rapport généré le ${fmtDate(new Date())} · Période : ${fmtDateStr(dateFrom)}${dateTo&&dateTo!==dateFrom?' → '+fmtDateStr(dateTo):''}</div>
    </div>`;
  roles.forEach(role=>{
    const tasks=getAllTasks(role.id);
    const done=tasks.filter(t=>isTaskDoneForDateHist(role.id,t.id,t.freq,dateFrom)).length;
    const pct=tasks.length?Math.round(done/tasks.length*100):0;
    const pc=pct>=80?'#27ae60':pct>=50?'#f39c12':'#e74c3c';
    html+=`<div class="role-section">
      <div class="role-section-head">
        <span class="rs-icon">${role.icon}</span>
        <span class="rs-name">${role.label}</span>
        <span class="rs-pct" style="color:${pc}">${pct}% (${done}/${tasks.length})</span>
      </div>
      <table><thead><tr>
        <th>Statut</th><th>Tâche</th><th>Fréquence</th><th>Commentaire</th>
      </tr></thead><tbody>
      ${tasks.map(t=>{
        const isDone=isTaskDoneForDateHist(role.id,t.id,t.freq,dateFrom);
        const note=getTaskNoteAny(role.id,t.id,t.freq);
        const freqColor=FC[t.freq]||'#999';
        return `<tr class="${isDone?'done-row':'undone-row'}">
          <td>${isDone?'✅':'⬜'}</td>
          <td>${t.label}${t.note?`<br><small style="color:#888">${t.note}</small>`:''}</td>
          <td><span class="task-freq" style="background:${freqColor}18;color:${freqColor}">${FL[t.freq]||t.freq}</span></td>
          <td>${note&&note.comment?`<div class="report-comment">💬 ${note.comment}</div>`:''}</td>
        </tr>`;
      }).join('')}
      </tbody></table></div>`;
  });
  html+='</body></html>';
  return html;
}

export async function exportPDF(dateFrom, dateTo, histComp) {
  const {jsPDF}=window.jspdf;
  const reportHTML=generateReportHTML(dateFrom,dateTo,histComp);
  const iframe=document.createElement('iframe');
  iframe.style.cssText='position:fixed;left:-9999px;width:794px;height:1123px;';
  document.body.appendChild(iframe);
  iframe.contentDocument.open();
  iframe.contentDocument.write(reportHTML);
  iframe.contentDocument.close();
  await new Promise(r=>setTimeout(r,1200));
  try {
    const canvas=await html2canvas(iframe.contentDocument.body,{scale:1.5,useCORS:true});
    const pdf=new jsPDF('p','mm','a4');
    const imgData=canvas.toDataURL('image/jpeg',0.92);
    const pgW=pdf.internal.pageSize.getWidth();
    const pgH=pdf.internal.pageSize.getHeight();
    const ratio=pgW/canvas.width;
    let y=0; const imgH=canvas.height*ratio;
    let remaining=imgH;
    while(remaining>0){
      pdf.addImage(imgData,'JPEG',0,y,pgW,imgH);
      remaining-=pgH; y-=pgH;
      if(remaining>0) pdf.addPage();
    }
    pdf.save(`rapport-${dateFrom||'pilotage'}.pdf`);
  } finally { document.body.removeChild(iframe); }
}
