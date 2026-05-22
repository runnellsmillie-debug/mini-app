// ==========================================
// BULUTLI SINXRONIZATSIYA VA API SOZLAMALARI
// ==========================================
const API_BASE = "https://mini-app-gkr9.onrender.com"; // Render manzilingiz
const urlParams = new URLSearchParams(window.location.search);
window.currentBudgetId = urlParams.get('bid'); // Botdan kelgan oilaviy ID
window.sessionData = window.sessionData || []; // Vaqtinchalik tranzaksiyalar
window.amtStr = ""; 

// ==========================================
// 1. DASTUR HOLATI (STATE)
// ==========================================
window.state = {
    txs: [], plan: [], sched: [], debts: [], incs: [], profiles: [], deps: [], credits: []
};

// ==========================================
// 2. MA'LUMOTLARNI YUKLASH (Bulut va Kesh)
// ==========================================
window.initCloudData = async function() {
    let loadedFromCloud = false;
    
    // 1. Bulutdan qidiramiz
    if (window.currentBudgetId) {
        try {
            let res = await fetch(`${API_BASE}/api/state/${window.currentBudgetId}`);
            let json = await res.json();
            if (json.status === "ok" && Object.keys(json.data).length > 0) {
                window.state = { ...window.state, ...json.data };
                loadedFromCloud = true;
                console.log("Ma'lumotlar bulutdan muvaffaqiyatli yuklandi.");
            }
        } catch(e) { 
            console.error("Bulutga ulanishda xatolik:", e); 
        }
    }
    
    // 2. Agar bulutda bo'lmasa yoki internet yo'q bo'lsa, telefon xotirasidan olamiz
    if (!loadedFromCloud) {
        // Eski versiya (xarajat_pro_v8) yoki yangi versiya (family_erp_state) xotirasini tekshiramiz
        const raw = localStorage.getItem('family_erp_state') || localStorage.getItem('xarajat_pro_v8');
        if (raw) { 
            try { window.state = { ...window.state, ...JSON.parse(raw) }; } catch(e) {} 
        }
    }
    
    postLoadInit();
};

async function postLoadInit() {
    // Profillar yo'q bo'lsa yaratamiz
    if (!window.state.profiles || !window.state.profiles.length) {
        window.state.profiles = [ { id: "general", name: "Umumiy", icon: "🏠", age: null, role: "parent_m" }, { id: "home_profile", name: "Uy/Ro'zg'or", icon: "🏡", age: null, role: "home" } ];
    }
    
    // Ro'yxatlar yo'q bo'lsa bo'sh massiv yaratamiz
    ['txs','incs','debts','sched','plan','deps','credits'].forEach(k => { if(!window.state[k]) window.state[k] = []; });
    
    if(window.loadExternalData) await window.loadExternalData();
    
    // Sanalarni bugungi kunga to'g'rilash
    const t = new Date().toISOString().slice(0,10);
    window.setVal("rep-from", t); window.setVal("rep-to", t); window.setVal("debt-start", t); window.setVal("dep-date", t); window.setVal("credit-date", t);
    
    // UI qismlarini yuklash
    if(window.renderSidebar) window.renderSidebar();
    if(window.updatePlanCats) window.updatePlanCats();
    if(window.initDragAndDrop) window.initDragAndDrop();
    
    window.render(); // Asosiy chizuvchini chaqiramiz
}

// ==========================================
// 3. BULUTGA VA XOTIRAGA SAQLASH
// ==========================================
window.save = function(force = false) {
    // 1. Zaxira uchun telefonga saqlaymiz
    localStorage.setItem('family_erp_state', JSON.stringify(window.state));
    
    // 2. Bulutga saqlaymiz
    if (window.currentBudgetId) {
        fetch(`${API_BASE}/api/state/${window.currentBudgetId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(window.state)
        }).catch(err => console.error("Bulutga saqlash xatosi:", err));
    }
    
    if (!force && typeof window.render === 'function') window.render();
};

window.resetAppData = function() {
    if(confirm("Barcha ma'lumotlar o'chadi. Dastur toza 0 holatiga qaytadi. Ishonchingiz komilmi?")) {
        localStorage.removeItem('family_erp_state');
        localStorage.removeItem('xarajat_pro_v8');
        window.state = { txs: [], plan: [], sched: [], debts: [], incs: [], profiles: [], deps: [], credits: [] };
        window.save(true);
        alert("Barcha ma'lumotlar tozalandi!");
        window.location.reload();
    }
};

window.saveAndExit = () => { 
    window.save(true);
    if(window.sessionData && window.sessionData.length>0 && window.Telegram?.WebApp) {
        window.Telegram.WebApp.sendData(JSON.stringify(window.sessionData)); 
    } else if(window.Telegram?.WebApp) {
        window.Telegram.WebApp.close(); 
    } else {
        window.toast("Saqlandi!"); 
    }
};

// ==========================================
// 4. ASOSIY BOSHQRUV VA UI (Sizning kodingiz)
// ==========================================
window.setAddMode = m => { 
    window.addMode = m; window.actMainCat = null; window.actSubCat = null; 
    window.el("mode-exp").style.background = m==="expense" ? "var(--danger)" : "var(--bg-card)"; 
    window.el("mode-exp").style.borderColor = m==="expense" ? "var(--danger)" : "var(--border-color)"; 
    window.el("mode-inc").style.background = m==="income" ? "var(--success)" : "var(--bg-card)"; 
    window.el("mode-inc").style.borderColor = m==="income" ? "var(--success)" : "var(--border-color)"; 
    window.setHtml("stay-hint",""); window.renderAddCats(); 
};

window.pressNum = v => {
    if (v==="C") window.amtStr=""; else if(v==="⌫") window.amtStr=window.amtStr.slice(0,-1); else if(window.amtStr.length<12) window.amtStr+=v;
    let displayVal = "0"; if (window.amtStr) displayVal = parseInt(window.amtStr).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    window.setTxt("num-display", displayVal);
};

window.getCats = function() { return window.CATS_DATA[window.curProf === "home_profile" ? "home" : (window.state.profiles.find(x=>x.id===window.curProf)?.role||"general")] || window.CATS_DATA.general; };

window.renderAddCats = function() {
    const cont = window.el("cats-container"), head = window.el("cats-header-container"); if(!cont || !head) return;
    if (window.addMode === "income") { head.innerHTML = ""; cont.innerHTML = `<div class="cat-scroll-container">` + window.INC_SOURCES.map(s => `<button class="cat-btn" onclick="saveTx('${s.label}')"><span style="font-size:24px;">${s.icon}</span><span>${s.label}</span></button>`).join("") + `</div>`; return; }
    
    const cats = window.getCats();
    if (window.actSubCat) {
        head.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; background:var(--bg-card); padding:8px 12px; border-radius:10px; border:1px solid var(--border-color);"><span style="font-size:12px; color:var(--text-muted);">${window.actMainCat.label} <b style="color:var(--primary); margin:0 4px;">›</b> <b style="color:#fff">${window.actSubCat.label}</b></span><button onclick="backCat()" style="background:transparent; color:var(--primary); border:none; font-weight:bold; font-size:12px; cursor:pointer;">⬅ Orqaga</button></div>`;
        cont.innerHTML = `<div class="cat-scroll-container">` + window.actSubCat.items.map(i => `<button class="cat-btn" style="background:rgba(59, 130, 246, 0.15); border-color:var(--primary);" onclick="saveTx('${i.label}', true)"><span style="font-size:24px;">${i.icon}</span><span>${i.label}</span></button>`).join("") + `</div>`;
    } else if (window.actMainCat && window.actMainCat.subs && window.actMainCat.subs.length > 0) {
        head.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; background:var(--bg-card); padding:8px 12px; border-radius:10px; border:1px solid var(--border-color);"><span style="font-size:12px; color:var(--text-muted);">Rukun: <b style="color:#fff">${window.actMainCat.label}</b></span><button onclick="backCat()" style="background:transparent; color:var(--primary); border:none; font-weight:bold; font-size:12px; cursor:pointer;">⬅ Orqaga</button></div>`;
        cont.innerHTML = `<div class="cat-scroll-container">` + window.actMainCat.subs.map(s => { const f = s.items?.length>0; return `<button class="cat-btn" style="background:var(--bg-card);" onclick="${f ? `clickSubCat('${s.id}')` : `saveTx('${s.label}')`}"><span style="font-size:24px;">${s.icon}</span><span>${s.label} ${f?'':'✓'}</span></button>`; }).join("") + `<button class="cat-btn" style="background:var(--bg-card); border:1px dashed var(--text-muted);" onclick="saveTx('${window.actMainCat.label}')"><span style="font-size:24px;">⚙️</span><span>Umumiy</span></button></div>`;
    } else {
        head.innerHTML = "";
        cont.innerHTML = `<div class="cat-scroll-container">` + cats.map(c => `<button class="cat-btn" style="background:${c.color||'var(--bg-card)'}22; border-color:${c.color||'var(--border-color)'}; color:${c.color};" onclick="clickMainCat('${c.id}')"><span style="font-size:24px;">${c.icon}</span><span style="color:#fff;">${c.label}</span></button>`).join("") + `</div>`;
    }
};

window.clickMainCat = id => { const c = window.getCats().find(x=>x.id==id); if(c && c.subs?.length) { window.actMainCat = c; window.renderAddCats(); window.setHtml("stay-hint",""); } else if(c) window.saveTx(c.label); };
window.clickSubCat = id => { const s = window.actMainCat.subs.find(x=>x.id==id); if(s && s.items?.length) { window.actSubCat = s; window.renderAddCats(); window.setHtml("stay-hint",""); } else if(s) window.saveTx(s.label); };
window.backCat = () => { if(window.actSubCat) window.actSubCat = null; else window.actMainCat = null; window.setHtml("stay-hint",""); window.renderAddCats(); };

window.saveTx = (l, isDeepItem=false) => {
    const a = parseFloat(window.amtStr); if(!a || a<=0) return window.toast("Summa yo'q!", true); const d = new Date(), de = window.el("add-desc");
    let realCat = window.actMainCat ? window.actMainCat.label : l, realSubCat = l;
    if(isDeepItem && window.actSubCat) realSubCat = `${window.actSubCat.label} › ${l}`; else if(window.actMainCat) realSubCat = l;

    const i = { id: Date.now(), amount: a, desc: de?.value.trim() || l, cat: realCat, subCat: realSubCat, date: d.toISOString().slice(0,10), time: d.toLocaleTimeString("uz-UZ",{hour:'2-digit',minute:'2-digit'}), user: window.tgUser, prof: window.curProf };
    if(window.addMode==="expense") window.state.txs.unshift(i); else window.state.incs.unshift(i); 
    window.sessionData.push({ amount: a, category: `${i.desc} [${window.tgUser}]`, type: window.addMode==='expense'?'minus':'plus' });
    window.amtStr = ""; if(de) de.value = ""; window.setTxt("num-display", "0"); 
    window.save(); // Saqlash shu yerdan chaqiriladi
    if(window.actSubCat||window.actMainCat) { window.setHtml("stay-hint", `✅ Oxirgi: <b style="color:var(--success);">${window.formatM(a)}</b>. Yana kiriting!`); window.renderAddCats(); } else window.setHtml("stay-hint", ""); window.toast("Saqlandi!");
};

window.renderReport = function() {
    let f = window.val("rep-from"), t = window.val("rep-to"); if(!f||!t) { const d = new Date().toISOString().slice(0,10); f=d; t=d; }
    const fTxs = window.state.txs.filter(x => x.date>=f && x.date<=t && (x.prof===window.curProf || window.curProf=='general'));
    const fIncs = window.state.incs.filter(x => x.date>=f && x.date<=t && (x.prof===window.curProf || window.curProf=='general'));
    const pInc = fIncs.reduce((s,i)=>s+i.amount, 0), pExp = fTxs.reduce((s,x)=>s+x.amount, 0);
    window.setTxt("rep-inc-val", window.formatM(pInc)); window.setTxt("rep-exp-val", window.formatM(pExp));

    let uExp = {}; fTxs.forEach(x => { const u = x.user||"Siz"; uExp[u] = (uExp[u]||0)+x.amount; });
    window.setHtml("user-stats-container", Object.entries(uExp).map(([u,a]) => `<div style="background:var(--bg-card); padding:10px 15px; border-radius:12px; border:1px solid var(--border-color); min-width:100px; text-align:center;"><div style="font-size:12px; color:var(--text-muted);">${u}</div><div style="font-weight:bold; font-size:15px; margin-top:4px;">${window.formatM(a).replace(" so'm","")}</div></div>`).join("") || "<div style='color:var(--text-muted); font-size:13px;'>Ma'lumot yo'q</div>");

    let cats = {}; fTxs.forEach(x => { cats[x.cat] = (cats[x.cat]||0)+x.amount; });
    window.setHtml("rep-cats-list", Object.entries(cats).map(([c,a]) => { const p = Math.round((a/pExp)*100); return `<div style="background:var(--bg-card); padding:12px; border-radius:12px; margin-bottom:8px;"><div style="display:flex; justify-content:space-between; font-weight:bold; font-size:13px; margin-bottom:6px;"><span>${c} (${p}%)</span><span>${window.formatM(a)}</span></div><div style="background:rgba(255,255,255,0.05); border-radius:4px; height:6px;"><div style="height:100%; border-radius:4px; width:${p}%; background:var(--primary);"></div></div></div>`; }).join("") || "<div style='text-align:center; color:var(--text-muted); font-size:13px;'>Xarajat yo'q.</div>");

    const cb = [...fIncs.map(i=>({...i,m:'plus'})), ...fTxs.map(x=>({...x,m:'minus'}))].sort((a,b)=>b.id-a.id);
    window.setHtml("rep-history-list", cb.map(i => `<div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--border-color); font-size:13px;"><div><div style="font-weight:bold; color:${i.m==='plus'?'var(--success)':'#fff'};">${i.desc}</div><div style="font-size:11px; color:var(--text-muted); margin-top:4px;">👤 ${i.user||'Siz'} | 📅 ${i.date}</div></div><div style="display:flex; align-items:center; gap:10px;"><span style="font-weight:bold; color:${i.m==='plus'?'var(--success)':'var(--danger)'};">${i.m==='plus'?'+':'-'}${window.formatM(i.amount).replace(" so'm","")}</span> <button class="delete-btn" onclick="delItem('${i.m==='minus'?'tx':'inc'}', ${i.id})">✕</button></div></div>`).join("") || "<div style='text-align:center; color:var(--text-muted); font-size:13px;'>Tarix bo'sh.</div>");
};

window.downloadExcel = () => { let c="\uFEFFSana,Profil,Turi,Odam,Rukun,Kategoriya,Izoh,Summa\n"; [...window.state.incs.map(i=>({...i,t:"Kirim"})), ...window.state.txs.map(t=>({...t,t:"Chiqim"}))].sort((a,b)=>b.id-a.id).forEach(r => { const p = window.state.profiles.find(x=>x.id==r.prof)?.name||'Umumiy'; c+=`${r.date},${p},${r.t},${r.user||'Siz'},${r.cat||''},${r.subCat||''},${r.desc},${r.amount}\n`; }); const b=new Blob([c], {type:'text/csv;charset=utf-8;'}); const l=document.createElement("a"); l.setAttribute("href", URL.createObjectURL(b)); l.setAttribute("download", "Hisobot.csv"); document.body.appendChild(l); l.click(); };

// ==========================================
// 5. BARCHASINI UPDATE QILUVCHI RENDER
// ==========================================
window.render = function() {
    const tInc = window.state.incs.reduce((s,i)=>s+i.amount, 0), tExp = window.state.txs.reduce((s,t)=>s+t.amount, 0);
    window.setTxt("main-total-balance", window.formatM(tInc - tExp)); 

    const d = new Date(), tM = d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,'0');
    let sHtml = ""; 
    window.state.sched.filter(s => !s.archived && (s.prof === window.curProf || window.curProf === "general")).forEach(s => {
        const getWD = (y,m) => { let d=new Date(y,m,0).getDate(), w=0; for(let i=1;i<=d;i++) { let day=new Date(y,m-1,i).getDay(); if(day!==0&&day!==6) w++; } return w; };
        const actAmt = s.miss > 0 ? Math.max(0, Math.round(s.amt - ((s.amt / getWD(parseInt(s.tMonth.split('-')[0]), parseInt(s.tMonth.split('-')[1]))) * s.miss))) : s.amt;
        const sm = parseInt(s.tMonth.replace("-","")), cm = parseInt(tM.replace("-","")); let isDue = false, st = "";
        if(sm < cm) { isDue = true; st = "O'tib ketgan!"; } else if(sm === cm) { if(d.getDate() >= s.day) { isDue = true; st = "Vaqti keldi!"; } else if(s.day - d.getDate() <= 3) { isDue = true; st = `${s.day - d.getDate()} kun qoldi`; } }
        if(isDue) sHtml += `<div class="plan-item"><div style="flex:1;"><span>⚠️ <b style="font-size:14px;">${s.label}</b> <span style="font-size:11px; color:var(--danger);">(${st})</span></span><div style="font-size:11px; color:var(--text-muted); margin-top:4px;">Qoldirilgan kun: <input type="number" onchange="updMiss(${s.id}, this.value)" value="${s.miss||''}" style="width:40px; padding:2px; background:var(--bg-dark); color:#fff; border:1px solid var(--border-color); text-align:center;"></div></div><div style="text-align:right;"><div style="font-weight:bold; font-size:14px; color:#fff;">${window.formatM(actAmt)}</div><button onclick="paySched(${s.id})" class="btn-primary btn-success" style="width:auto; padding:6px 10px; font-size:11px; margin-top:4px; margin-bottom:0;">To'lash</button></div></div>`;
    }); 
    window.setHtml("sched-list-container", sHtml || "<div style='text-align:center; color:var(--text-muted); font-size:13px; padding:10px;'>Majburiy to'lovlar yo'q.</div>"); 
    if(window.renderSchedSet) window.renderSchedSet();

    if(window.curTab === "add") window.renderAddCats();
    
    if(window.curTab === "other") {
        const todayStr = new Date().toISOString().slice(0,10); const today = new Date();
        
        // DEBTS RENDER
        let activeDebts = window.state.debts.filter(x=>!x.archived);
        let hDebts = activeDebts.map(x => `<div class="list-item" style="border-left: 5px solid ${x.type=='take'?'var(--success)':'var(--danger)'}; flex-direction:column; align-items:flex-start;"><div style="display:flex; justify-content:space-between; width:100%; margin-bottom:6px;"><div><div style="font-size:15px; font-weight:bold;">${x.name}</div><div style="font-size:11px; color:var(--text-muted);">${x.type=='take'?'Olaman':'Beraman'}</div></div><div style="font-weight:bold; font-size:15px;">${window.formatM(x.amount)}</div></div><button onclick="closeDebt(${x.id})" class="btn-primary btn-success" style="padding:10px; font-size:13px; margin-bottom:0;">✅ Qarz uzildi</button></div>`).join("");
        window.setHtml("debts-list", hDebts || "<div style='text-align:center; color:var(--text-muted); font-size:13px;'>Qarzlar yo'q.</div>");

        // DEPOSITS RENDER
        let activeDeps = window.state.deps.filter(x=>!x.archived), archDeps = window.state.deps.filter(x=>x.archived);
        let hDepsAct = activeDeps.map(dep => `<div class="list-item" style="border-left: 5px solid var(--success); flex-direction:column; align-items:flex-start;"><div style="display:flex; justify-content:space-between; width:100%; margin-bottom:10px;"><div><div style="font-size:15px; font-weight:bold; color:var(--success);">${dep.bankIcon||'🏦'} ${dep.name}</div></div><div style="text-align:right;"><div style="font-weight:bold; font-size:16px;">${window.formatM(dep.amount)}</div></div></div><div style="display:flex; gap:6px; width:100%;"><button onclick="openTopupModal(${dep.id})" class="btn-primary" style="flex:1; background:transparent; border:1px solid var(--primary); color:var(--primary); padding:8px 2px; font-size:11px; margin-bottom:0;">+ Qo'sh</button><button onclick="openIntModal(${dep.id})" class="btn-primary" style="flex:1; background:transparent; border:1px solid var(--success); color:var(--success); padding:8px 2px; font-size:11px; margin-bottom:0;">💸 Foiz</button><button onclick="openDepScheduleModal(${dep.id})" class="btn-primary" style="flex:1; background:transparent; border:1px solid var(--warning); color:var(--warning); padding:8px 2px; font-size:11px; margin-bottom:0;">📊 Grafik</button></div><button onclick="closeDep(${dep.id})" class="btn-primary" style="width:100%; background:var(--danger); margin-top:8px; padding:10px; font-size:13px; margin-bottom:0;">Omonatni Yopish</button></div>`).join("");
        let hDepsArch = archDeps.map(dep => `<div class="list-item" style="border-left: 5px solid var(--text-muted); flex-direction:column; align-items:flex-start; filter: grayscale(100%);"><div style="display:flex; justify-content:space-between; width:100%;"><div><div style="font-size:15px; font-weight:bold; color:var(--text-muted); text-decoration:line-through;">${dep.bankIcon||'🏦'} ${dep.name}</div></div><div style="text-align:right;"><div style="font-weight:bold; font-size:16px; color:var(--text-muted);">${window.formatM(dep.amount)}</div></div></div><button onclick="permDelDep(${dep.id})" class="btn-primary" style="background:transparent; border:1px solid var(--danger); color:var(--danger); padding:8px; font-size:12px; margin-top:10px; width:100%; margin-bottom:0;">🗑️ O'chirish</button></div>`).join("");
        window.setHtml("deposits-list-active", hDepsAct || "<div style='text-align:center; color:var(--text-muted); font-size:13px; margin-top:20px;'>Aktiv omonatlar yo'q.</div>");
        window.setHtml("deposits-list-archived", hDepsArch || "<div style='text-align:center; color:var(--text-muted); font-size:13px; margin-top:20px;'>Arxivlangan omonatlar yo'q.</div>");

        // CREDITS RENDER (Aktiv / Arxiv)
        let activeCredits = window.state.credits.filter(x=>!x.archived), archCredits = window.state.credits.filter(x=>x.archived);
        let hCredits = activeCredits.map(cr => {
            let overdue = false; let nextUnpaid = cr.schedule.find(x => x.status === 'unpaid');
            if (nextUnpaid && nextUnpaid.date < todayStr) overdue = true;
            let borderCol = overdue ? "var(--danger)" : "#ec4899"; let bgCol = overdue ? "rgba(239, 68, 68, 0.1)" : "var(--bg-card)";
            let currentBal = cr.initAmt - cr.schedule.filter(x => x.status === 'paid').reduce((s, x) => s + x.principal, 0) - (cr.extraPrincipalPaid || 0);
            return `<div class="list-item" style="border-left: 5px solid ${borderCol}; background:${bgCol}; flex-direction:column; align-items:flex-start;"><div style="display:flex; justify-content:space-between; width:100%; margin-bottom:10px;"><div><div style="font-size:15px; font-weight:bold; color:${borderCol};">${cr.bankIcon||'🏦'} ${cr.name}</div><div style="font-size:11px; color:var(--text-muted); margin-top:4px;">${cr.rate}%</div>${overdue?`<div style="font-size:10px; color:var(--danger); font-weight:bold; margin-top:4px;">⚠️ Muddat o'tgan!</div>`:''}</div><div style="text-align:right;"><div style="font-weight:bold; font-size:16px; color:${borderCol};">${window.formatM(currentBal)}</div></div></div><div style="display:flex; gap:6px; width:100%;"><button onclick="payNextMonthCredit(${cr.id})" class="btn-primary" style="flex:1; background:transparent; border:1px solid var(--success); color:var(--success); padding:8px 4px; font-size:11px; margin-bottom:0;">💸 Oylik</button><button onclick="openPrincipalPayModal(${cr.id})" class="btn-primary" style="flex:1; background:transparent; border:1px solid var(--warning); color:var(--warning); padding:8px 4px; font-size:11px; margin-bottom:0;">📉 Tanidan</button><button onclick="openCreditScheduleModal(${cr.id})" class="btn-primary" style="flex:1; background:transparent; border:1px solid var(--primary); color:var(--primary); padding:8px 4px; font-size:11px; margin-bottom:0;">📊 Grafik</button></div><button onclick="closeCredit(${cr.id})" class="btn-primary" style="width:100%; background:var(--danger); margin-top:8px; padding:10px; font-size:13px; margin-bottom:0;">Kreditni Yopish (To'liq)</button></div>`;
        }).join("");
        let archHtmlCredits = archCredits.map(cr => `<div class="list-item" style="border-left: 5px solid var(--text-muted); flex-direction:column; align-items:flex-start; filter: grayscale(100%);"><div style="display:flex; justify-content:space-between; width:100%;"><div><div style="font-size:15px; font-weight:bold; color:var(--text-muted); text-decoration:line-through;">${cr.bankIcon||'🏦'} ${cr.name}</div></div><div style="text-align:right;"><div style="font-weight:bold; font-size:16px; color:var(--text-muted);">${window.formatM(cr.initAmt)}</div></div></div><button onclick="permDelCredit(${cr.id})" class="btn-primary" style="background:transparent; border:1px solid var(--danger); color:var(--danger); padding:8px; font-size:12px; margin-top:10px; width:100%; margin-bottom:0;">🗑️ Butunlay o'chirish</button></div>`).join("");
        
        window.setHtml("credits-list-active", hCredits || "<div style='text-align:center; color:var(--text-muted); font-size:13px; margin-top:20px;'>Aktiv kreditlar yo'q.</div>");
        window.setHtml("credits-list-archived", archHtmlCredits || "<div style='text-align:center; color:var(--text-muted); font-size:13px; margin-top:20px;'>Arxivlangan kreditlar yo'q.</div>");
        
        if(window.el('bank-sub-plan') && !window.el('bank-sub-plan').classList.contains('hidden')) window.renderPlanned();
    }
    if(window.curTab === "report") window.renderReport();
};

// ==========================================
// DASTURNI ISHGA TUSHIRISH (BOOTSTRAP)
// ==========================================
if(document.readyState==="loading") {
    document.addEventListener("DOMContentLoaded", window.initCloudData);
} else {
    window.initCloudData();
}

// ==========================================
// 6. AVTOMATIK SINXRONIZATSIYA (JONLI REJIM)
// ==========================================
window.startAutoSync = function() {
    if (!window.currentBudgetId) return;
    
    // Har 5 soniyada (5000 ms) orqa fonda bazani tekshiradi
    setInterval(async () => {
        try {
            let res = await fetch(`${API_BASE}/api/state/${window.currentBudgetId}`);
            let json = await res.json();
            
            if (json.status === "ok" && Object.keys(json.data).length > 0) {
                let cloudDataStr = JSON.stringify(json.data);
                let localDataStr = JSON.stringify(window.state);
                
                // Agar serverdagi ma'lumot telefondagidan farq qilsa, ekranni darhol yangilaydi
                if (cloudDataStr !== localDataStr) {
                    window.state = json.data;
                    localStorage.setItem('family_erp_state', cloudDataStr);
                    
                    if (typeof window.render === 'function') window.render();
                    if (typeof window.updatePlanCats === 'function') window.updatePlanCats();
                    console.log("Ma'lumotlar avtomatik yangilandi!");
                }
            }
        } catch(e) {
            // Orqa fondagi xatoliklarni sezdirmaslik
        }
    }, 3000); 
};

// Dastur yuklanganda jonli rejimni ishga tushirish
if(document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", window.startAutoSync);
} else {
    window.startAutoSync();
}
