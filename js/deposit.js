// ==========================================
// DEPOSIT.JS - Omonatlar mantiqi
// ==========================================

window.renderDepBankSelect = () => { 
    const bEl = window.el("dep-bank"); if(!bEl) return; 
    bEl.innerHTML = '<option value="">Bankni tanlang...</option>' + Object.keys(window.DEP_DB).map(b => `<option value="${b}">${window.DEP_DB[b].icon||'🏦'} ${b}</option>`).join(""); 
    bEl.innerHTML += '<option value="Boshqa">🔄 Boshqa joyga</option>'; 
    window.updateDepTypes(); 
};

window.updateDepTypes = () => { 
    const b = window.val("dep-bank"), tEl = window.el("dep-type-name"); if(!tEl) return; 
    if(b === "Boshqa") { tEl.classList.add('hidden'); window.el('dep-custom-name').classList.remove('hidden'); window.onDepTypeChange(); return; } 
    tEl.classList.remove('hidden'); window.el('dep-custom-name').classList.add('hidden'); 
    if(!b || !window.DEP_DB[b]) { tEl.innerHTML = '<option value="">Omonat turini tanlang...</option>'; return; } 
    tEl.innerHTML = '<option value="">Omonat turini tanlang...</option>' + window.DEP_DB[b].deposits.map(c => `<option value="${c.id}">${c.name} (${c.rate}%)</option>`).join(""); 
    window.onDepTypeChange(); 
};

window.onDepTypeChange = () => { 
    const b = window.val("dep-bank"), tId = window.val("dep-type-name"); 
    if(b && b !== "Boshqa" && tId && window.DEP_DB[b]) { 
        const dp = window.DEP_DB[b].deposits.find(x => x.id === tId); 
        if(dp) { 
            window.el("dep-rate").value = dp.rate; 
            window.el("dep-duration").value = dp.duration; 
            window.el("dep-amount").placeholder = `Min: ${new Intl.NumberFormat('ru-RU').format(dp.minAmt)}`; 
            window.el("dep-ratetype").value = dp.rateType || 'annual'; 
            window.el("dep-cap").checked = dp.cap || false; 
        } 
    } else { 
        window.el("dep-rate").value = ""; window.el("dep-duration").value = ""; window.el("dep-amount").placeholder = "Boshlang'ich summa..."; 
    } 
};

window.updateBankData = async () => { 
    window.toast("Ma'lumotlar yangilanmoqda...", false); 
    await window.loadExternalData(); 
    window.toast("Muvaffaqiyatli yangilandi!"); 
};

window.saveDeposit = () => { 
    const b = window.val("dep-bank"); const tId = window.val("dep-type-name"); 
    const bankObj = window.DEP_DB[b]; const dpObj = bankObj ? bankObj.deposits.find(x => x.id === tId) : null; 
    const n = (b === "Boshqa") ? window.val("dep-custom-name").trim() : ((bankObj && dpObj) ? `${b} - ${dpObj.name}` : "Nomsiz Omonat"); 
    const a=window.getNum("dep-amount"), s=window.val("dep-date"), d=parseInt(window.val("dep-duration")), r=parseFloat(window.val("dep-rate")), rt=window.val("dep-ratetype"), cap=window.el("dep-cap").checked; 
    
    if(!b || (b !== "Boshqa" && !tId) || !a||!s||!d||!r) return window.toast(window.t("error_short"), true); 
    if(dpObj && a < dpObj.minAmt) return window.toast(`Minimal summa: ${window.formatM(dpObj.minAmt)}`, true); 
    
    window.state.deps.push({id:Date.now(), name:n, bankIcon: bankObj?.icon, amount:a, start:s, duration:d, rate:r, rateType:rt, cap:cap, archived:false, topups:0, profits:0, initAmt:a}); 
    window.state.txs.unshift({id:Date.now()+1, amount:a, desc:`Omonat: ${n}`, cat:"Bank", date:s, time:"00:00", user:window.tgUser, prof:"general"}); 
    
    window.setVal("dep-bank",""); window.setVal("dep-type-name",""); window.setVal("dep-custom-name",""); window.el("dep-amount").value=""; window.setVal("dep-duration",""); window.setVal("dep-rate",""); 
    window.switchDepTab('aktiv'); window.save(); window.toast(window.t("saved")); 
};

window.openTopupModal = id => { 
    window.curDepId = id; window.setTxt("topup-name", window.state.deps.find(x=>x.id==id).name); window.el("topup-amount").value=""; window.openModal('modal-dep-topup'); 
};

window.confirmTopup = () => { 
    const a = window.getNum("topup-amount"); if(!a||a<=0) return window.toast(window.t("error_short"), true); 
    const dep = window.state.deps.find(x=>x.id==window.curDepId); if(!dep) return; 
    dep.amount += a; dep.topups = (dep.topups||0) + a; 
    window.state.txs.unshift({id:Date.now(), amount:a, desc:`Omonat qo'shildi: ${dep.name}`, cat:"Bank", date:new Date().toISOString().slice(0,10), time:"00:00", user:window.tgUser, prof:"general"}); 
    window.closeModal('modal-dep-topup'); window.save(); window.toast(window.t("added")); 
};

window.openIntModal = id => { 
    window.curDepId = id; const d=window.state.deps.find(x=>x.id==id); 
    let est = d.rateType === 'annual' ? (d.amount * (d.rate/100) / 12) : (d.amount * (d.rate/100)); 
    window.setTxt("interest-info", `${d.name} (${d.rate}% ${d.rateType==='annual'?'Yil':'Oy'}).\nKapitalizatsiya: ${d.cap?'HA':'YO\'Q'}`); 
    window.el("interest-amount").value = new Intl.NumberFormat('ru-RU').format(Math.round(est)).replace(/,/g, ' '); 
    window.openModal('modal-dep-interest'); 
};

window.confirmInterest = () => { 
    const a=window.getNum("interest-amount"); if(!a||a<=0) return window.toast(window.t("error_short"), true); 
    const d=window.state.deps.find(x=>x.id==window.curDepId); if(!d) return; 
    d.profits = (d.profits||0) + a; 
    if(d.cap) { d.amount += a; } 
    else { window.state.incs.unshift({id:Date.now(), amount:a, desc:`Foiz: ${d.name}`, cat:"Bank", date:new Date().toISOString().slice(0,10), time:"00:00", user:window.tgUser, prof:"general"}); if(window.creditIncomeToReserve) window.creditIncomeToReserve(a, `Foiz: ${d.name}`); } 
    window.closeModal('modal-dep-interest'); window.save(); window.toast(window.t("saved")); 
};

window.openDepScheduleModal = id => { 
    const d = window.state.deps.find(x=>x.id==id); if(!d) return; 
    window.setTxt("schedule-title", "Omonat Grafigi"); 
    window.setTxt("schedule-info", `${d.bankIcon||'🏦'} ${d.name}\nBoshlang'ich: ${window.formatM(d.amount)}\nShart: ${d.rate}% ${d.rateType==='annual'?'Yillik':'Oylik'} (${d.cap?'Kapitalizatsiya':'Oddiy'})`); 
    let html = "<tr><th>Oy</th><th>Tushum</th><th>Jami Qoldiq</th></tr>", currentBal = d.amount, mRate = d.rateType === 'annual' ? (d.rate/100)/12 : (d.rate/100), startDate = new Date(d.start), totalProfit = 0; 
    for(let i=1; i<=d.duration; i++) { 
        startDate.setMonth(startDate.getMonth() + 1); let monthStr = startDate.toISOString().slice(0,10); 
        let interest = d.cap ? (currentBal * mRate) : (d.amount * mRate); totalProfit += interest; if(d.cap) currentBal += interest; 
        html += `<tr><td><b>${i}</b><br><span style="font-size:9px;color:var(--text-muted)">${monthStr}</span></td><td style="color:var(--success)">+${window.formatM(interest)}</td><td>${window.formatM(currentBal)}</td></tr>`; 
    } 
    window.setHtml("schedule-table", html); window.setTxt("schedule-footer", `Kutilayotgan Jami foyda: ${window.formatM(totalProfit)}`); 
    window.openModal("modal-schedule"); 
};

window.closeDep = id => { 
    window.initCloseActionOld(() => { 
        const d=window.state.deps.find(x=>x.id==id); if(!d) return; 
        window.state.incs.unshift({id:Date.now(), amount:d.amount, desc:`Omonat qaytdi: ${d.name}`, cat:"Bank", date:new Date().toISOString().slice(0,10), time:"00:00", user:window.tgUser, prof:"general"});
        if(window.creditIncomeToReserve) window.creditIncomeToReserve(d.amount, `Omonat qaytdi: ${d.name}`); 
        d.archived = true; d.closeDate = new Date().toISOString().slice(0,10); 
        window.save(); window.switchDepTab('arxiv'); window.toast(window.t("saved")); 
    }); 
};

window.permDelDep = id => { 
    window.state.deps=window.state.deps.filter(x=>x.id!=id); 
    window.save(); window.switchDepTab('arxiv'); window.toast(window.t("deleted_excl")); 
};
