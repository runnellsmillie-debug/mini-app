// ==========================================
// SERVICES.JS - Bozorlik, Rejali to'lovlar va Qarzlar
// ==========================================

window.updatePlanCats = () => { 
    const cEl = window.el("smart-plan-cat"); if(!cEl) return; 
    const p = window.state.profiles.find(x=>x.id===window.curProf); 
    const isChild = p && p.age !== null && p.age < 16 && p.id !== "general" && p.id !== "home_profile"; 
    let c = isChild ? ["Kiyim", "Talim", "Oyinchoq"] : (p?.id === "home_profile" ? ["Oziq-ovqat", "Uy_Xojalik"] : Object.keys(window.PLAN_TAGS)); 
    cEl.innerHTML = c.map(x => `<option value="${x}">${x.replace(/_/g,' ')}</option>`).join(""); 
    window.updateSmartTags(); 
};

window.updateSmartTags = () => { 
    const cat = window.val("smart-plan-cat"), subEl = window.el("smart-plan-subcat"); if(!cat || !subEl) return; 
    subEl.innerHTML = ""; 
    if (window.PLAN_TAGS[cat]) { 
        window.show("smart-plan-subcat"); 
        Object.keys(window.PLAN_TAGS[cat]).forEach(s => { subEl.innerHTML += `<option value="${s}">${s.replace(/_/g,'/')}</option>`; }); 
    } else window.hide("smart-plan-subcat"); 
    window.renderSmartTags(); 
};

window.renderSmartTags = () => { 
    const c = window.val("smart-plan-cat"), s = window.val("smart-plan-subcat"), cont = window.el("smart-tags-container"); 
    cont.innerHTML = ""; 
    if(window.PLAN_TAGS[c] && window.PLAN_TAGS[c][s]) {
        window.PLAN_TAGS[c][s].forEach(t => { cont.innerHTML += `<div class="smart-tag" onclick="quickAddPlan('${t}')">${t}</div>`; }); 
    } else cont.innerHTML = "<span style='color:var(--text-muted); font-size:12px;'>Yo'q.</span>"; 
};

window.quickAddPlan = t => { 
    const ni = window.el("plan-name"), qi = window.el("plan-qty"); ni.value = t; qi.value = ""; 
    ni.style.borderColor = "var(--success)"; setTimeout(() => ni.style.borderColor = "var(--border-color)", 600); 
    qi.focus(); window.toast("Hajmini yozing"); 
};

window.addPlannedItemManual = () => { 
    const n = window.val("plan-name").trim(), q = window.val("plan-qty").trim(), c = window.val("smart-plan-cat"), m = window.val("plan-market"), p = window.getNum("plan-price"); 
    if(!n) return window.toast("Nomi kerak!", true); 
    window.state.plan.push({ id: Date.now(), text: q ? `${n} (${q})` : n, cat: c, market: m, price: p, prof: window.curProf, skip: null, archived: false }); 
    window.setVal("plan-name",""); window.setVal("plan-qty",""); window.el("plan-price").value=""; 
    window.save(); window.toast("Qo'shildi!"); 
};

window.toggleSkipPlan = id => { 
    const t = new Date().toISOString().slice(0,10); const i = window.state.plan.find(x=>x.id==id); 
    if(i) { i.skip = i.skip===t ? null : t; window.save(); } 
};

window.openBuyModal = id => { 
    const i = window.state.plan.find(x=>x.id==id); if(!i) return; 
    window.buyPlanId = id; window.setTxt("buy-item-name", `✅ Olinyapti: ${i.text}`); 
    window.el("buy-price").value = i.price ? new Intl.NumberFormat('ru-RU').format(i.price).replace(/,/g, ' ') : ""; 
    window.openModal("modal-buy"); 
};

window.confirmBuyItem = () => { 
    const p = window.getNum("buy-price"); if(!p || p<=0) return window.toast("Narx xato!", true); 
    const i = window.state.plan.find(x=>x.id==window.buyPlanId); if(!i) return; 
    const d = new Date(); 
    window.state.txs.unshift({ id: Date.now(), amount: p, desc: i.text, cat: i.cat, subCat: i.market, date: d.toISOString().slice(0,10), time: d.toLocaleTimeString("uz-UZ", {hour:'2-digit', minute:'2-digit'}), user: window.tgUser, prof: i.prof }); 
    i.archived = true; i.buyPrice = p; i.buyDate = d.toISOString().slice(0,10); 
    window.closeModal("modal-buy"); window.save(); window.toast("Xarid ✅"); 
};

window.permDelPlan = id => { window.state.plan = window.state.plan.filter(x=>x.id!=id); window.save(); window.toast("O'chirildi!"); };

window.renderPlanned = () => {
    const fc = window.val("filter-cat"), fm = window.val("filter-market"), t = new Date().toISOString().slice(0,10); 
    let p = window.state.plan.filter(x => x.prof === window.curProf || window.curProf === "general" || (window.curProf === "home_profile" && x.prof === "home_profile"));
    if(fc && fc!=="all") p = p.filter(x=>x.cat===fc); if(fm && fm!=="all") p = p.filter(x=>x.market===fm);
    let active = p.filter(x => !x.archived);
    let h = active.map(x => { 
        const sk = x.skip === t; 
        return `<div class="plan-item ${sk?'skipped':''}"><div class="custom-checkbox ${!sk?'checked':''}" onclick="toggleSkipPlan(${x.id})"></div><div style="flex:1;"><div style="font-weight:bold; color:var(--primary); font-size:14px; text-decoration:${sk?'line-through':'none'};">${x.text}</div><div style="font-size:11px; color:var(--text-muted); margin-top:4px;">📍 ${x.market} | 🏷️ ${x.cat.replace(/_/g,' ')}</div></div><button onclick="openBuyModal(${x.id})" class="btn-primary btn-success" style="width:auto; padding:8px 12px; font-size:12px;" ${sk?'disabled':''}>Olish</button></div>`; 
    }).join("");
    window.setHtml("planned-list-container", (h || "<div style='color:var(--text-muted); font-size:12px; text-align:center;'>Ro'yxat bo'sh.</div>"));
};

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
    else window.state.incs.unshift({id:Date.now()+1, amount:a, desc:`Qarz olindi: ${n}`, cat:"Qarz", date:s, time:"00:00", user:window.tgUser, prof:"general"}); 
    window.setVal("debt-name",""); window.el("debt-amount").value=""; 
    window.save(); window.toast("Saqlandi!"); 
};

window.closeDebt = id => { window.initCloseActionOld(() => { const d=window.state.debts.find(x=>x.id==id); if(!d) return; const t=new Date().toISOString().slice(0,10); if(d.type==="take") window.state.incs.unshift({id:Date.now(), amount:d.amount, desc:`Qarz qaytdi: ${d.name}`, cat:"Qarz", date:t, time:"00:00", user:window.tgUser, prof:"general"}); else window.state.txs.unshift({id:Date.now(), amount:d.amount, desc:`Qarz to'landi: ${d.name}`, cat:"Qarz", date:t, time:"00:00", user:window.tgUser, prof:"general"}); d.archived = true; d.closeDate = t; window.save(); window.toast("Uzildi!"); }); };
window.permDelDebt = id => { window.state.debts=window.state.debts.filter(x=>x.id!=id); window.save(); window.toast("O'chirildi!"); };
