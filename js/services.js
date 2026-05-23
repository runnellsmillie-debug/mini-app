// ==========================================
// SERVICES.JS - Rejali to'lovlar va Qarzlar
// ==========================================

window.addScheduled = () => {
    const n = window.val("sched-name").trim(), d = parseInt(window.val("sched-day")), a = window.getNum("sched-amount"), c = window.val("sched-cat");
    if(!n||!d||d<1||d>31||!a) return window.toast("Xato!", true); 
    const tm = new Date().getFullYear() + "-" + String(new Date().getMonth()+1).padStart(2,'0');
    window.state.sched.push({ id: Date.now(), label: n, day: d, amt: a, cat: c, tMonth: tm, miss: 0, prof: window.curProf, archived: false, paidTotal: 0 }); 
    window.setVal("sched-name",""); window.setVal("sched-day",""); window.el("sched-amount").value=""; 
    window.save(); window.toast("Qo'shildi!");
};

window.delSched = id => { window.initCloseActionOld(() => { const s=window.state.sched.find(x=>x.id==id); if(s) { s.archived=true; s.closeDate = new Date().toISOString().slice(0,10); window.save(); window.toast("Arxivlandi!"); } }); };
window.permDelSched = id => { window.state.sched=window.state.sched.filter(x=>x.id!=id); window.save(); window.toast("O'chirildi!"); };
window.updMiss = (id, v) => { const s = window.state.sched.find(x=>x.id==id); if(s) { s.miss = parseInt(v)||0; window.save(); } };

window.paySched = id => {
    const s = window.state.sched.find(x=>x.id==id); if(!s) return; 
    const getWD = (y,m) => { let d=new Date(y,m,0).getDate(), w=0; for(let i=1;i<=d;i++) { let day=new Date(y,m-1,i).getDay(); if(day!==0&&day!==6) w++; } return w; };
    const actAmt = s.miss > 0 ? Math.max(0, Math.round(s.amt - ((s.amt / getWD(parseInt(s.tMonth.split('-')[0]), parseInt(s.tMonth.split('-')[1]))) * s.miss))) : s.amt;
    const d = new Date(); 
    window.state.txs.unshift({ id: Date.now(), amount: actAmt, desc: `${s.label} (${s.tMonth})`, cat: s.cat, subCat: "", date: d.toISOString().slice(0,10), time: d.toLocaleTimeString('uz-UZ',{hour:'2-digit',minute:'2-digit'}), user: window.tgUser, prof: s.prof });
    s.paidTotal = (s.paidTotal||0) + actAmt; 
    let [y, m] = s.tMonth.split('-'); m = parseInt(m)+1; if(m>12){m=1;y=parseInt(y)+1;} s.tMonth = `${y}-${m.toString().padStart(2,'0')}`; s.miss = 0; 
    window.save(); window.toast("To'landi ✅");
};

window.renderSchedSet = function() {
    let p = window.state.sched.filter(s=>s.prof===window.curProf || window.curProf==="general"), active = p.filter(s=>!s.archived);
    let h = active.map(s => `<div class="list-item"><span><b>${s.label}</b> (${s.day}-sana)</span><button onclick="delSched(${s.id})" class="delete-btn">✕</button></div>`).join("");
    window.setHtml("sched-edit-list", h);
};

window.setDebtType = t => { window.debtType = t; window.el("debt-type-take").style.background = t==="take"?"var(--success)":"var(--bg-card)"; window.el("debt-type-give").style.background = t==="give"?"var(--danger)":"var(--bg-card)"; window.el("debt-type-take").style.borderColor = t==="take"?"var(--success)":"var(--border-color)"; window.el("debt-type-give").style.borderColor = t==="give"?"var(--danger)":"var(--border-color)"; };

window.saveDebt = () => { 
    const n=window.val("debt-name").trim(), a=window.getNum("debt-amount"), s=window.val("debt-start"), e=window.val("debt-due"); 
    if(!n||!a) return window.toast("Kam!", true); 
    window.state.debts.unshift({id:Date.now(), name:n, amount:a, type:window.debtType, start:s, due:e, archived:false}); 
    if(window.debtType === "take") window.state.txs.unshift({id:Date.now()+1, amount:a, desc:`Qarz berildi: ${n}`, cat:"Qarz", date:s, time:"00:00", user:window.tgUser, prof:"general"}); 
    else { window.state.incs.unshift({id:Date.now()+1, amount:a, desc:`Qarz olindi: ${n}`, cat:"Qarz", date:s, time:"00:00", user:window.tgUser, prof:"general"}); if(window.creditIncomeToReserve) window.creditIncomeToReserve(a, `Qarz olindi: ${n}`); } 
    window.setVal("debt-name",""); window.el("debt-amount").value=""; 
    window.save(); window.toast("Saqlandi!"); 
};

window.closeDebt = id => { window.initCloseActionOld(() => { const d=window.state.debts.find(x=>x.id==id); if(!d) return; const t=new Date().toISOString().slice(0,10); if(d.type==="take") { window.state.incs.unshift({id:Date.now(), amount:d.amount, desc:`Qarz qaytdi: ${d.name}`, cat:"Qarz", date:t, time:"00:00", user:window.tgUser, prof:"general"}); if(window.creditIncomeToReserve) window.creditIncomeToReserve(d.amount, `Qarz qaytdi: ${d.name}`); } else window.state.txs.unshift({id:Date.now(), amount:d.amount, desc:`Qarz to'landi: ${d.name}`, cat:"Qarz", date:t, time:"00:00", user:window.tgUser, prof:"general"}); d.archived = true; d.closeDate = t; window.save(); window.toast("Uzildi!"); }); };
window.permDelDebt = id => { window.state.debts=window.state.debts.filter(x=>x.id!=id); window.save(); window.toast("O'chirildi!"); };
