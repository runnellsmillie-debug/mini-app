// ==========================================
// CREDIT.JS - Kredit kalkulyatori va mantiqi
// ==========================================

window.renderBankSelect = () => {
    const bEl = window.el("credit-bank"); if(!bEl) return;
    bEl.innerHTML = '<option value="">Bankni tanlang...</option>' + Object.keys(window.BANK_DB).map(b => `<option value="${b}">${window.BANK_DB[b].icon||'🏦'} ${b}</option>`).join("");
    window.updateCreditTypes();
};

window.updateCreditTypes = () => {
    const b = window.val("credit-bank"), tEl = window.el("credit-type-name"); if(!tEl) return;
    if(!b || !window.BANK_DB[b]) { tEl.innerHTML = '<option value="">Turini tanlang...</option>'; return; }
    tEl.innerHTML = '<option value="">Turini tanlang...</option>' + window.BANK_DB[b].credits.map(c => `<option value="${c.id}">${c.icon||'💸'} ${c.name}</option>`).join("");
    window.onCreditTypeChange();
};

window.onCreditTypeChange = () => {
    const b = window.val("credit-bank"), tId = window.val("credit-type-name");
    if(b && tId && window.BANK_DB[b]) {
        const cr = window.BANK_DB[b].credits.find(x => x.id === tId);
        if(cr) {
            window.el("credit-limits-info").innerText = `Maks: ${window.formatM(cr.maxAmt).replace(" so'm","")} / ${cr.maxDur} oy`;
            window.el("credit-rate").value = cr.rate;
            
            const isAvtoOrHome = cr.name.includes("Avto") || cr.name.includes("Ipoteka");
            if(isAvtoOrHome) {
                window.el("credit-initial-fee").classList.remove('hidden'); window.el("insurance-fields").classList.remove('hidden');
            } else {
                window.el("credit-initial-fee").classList.add('hidden'); window.el("credit-initial-fee").value = "";
                window.el("insurance-fields").classList.add('hidden'); window.el("credit-insurance-fee").value = "";
            }
        }
    } else { 
        window.el("credit-limits-info").innerText = "Maksimal cheklovlar..."; window.el("credit-rate").value = ""; 
    }
    window.validateCreditLimits(); window.updateCreditAnalysis();
};

window.validateCreditLimits = () => {
    const b = window.val("credit-bank"), tId = window.val("credit-type-name");
    if(!b || !tId || !window.BANK_DB[b]) return;
    const cr = window.BANK_DB[b].credits.find(x => x.id === tId); if(!cr) return;

    let a = window.getNum("credit-amount"); let d = parseInt(window.val("credit-duration"));
    if(a > cr.maxAmt) { window.el("credit-amount").value = new Intl.NumberFormat('ru-RU').format(cr.maxAmt).replace(/,/g, ' '); window.toast("Maksimal summadan oshib ketdi!"); }
    if(d > cr.maxDur) { window.el("credit-duration").value = cr.maxDur; window.toast("Maksimal muddatdan oshib ketdi!"); }
};

window.toggleGraceFields = () => { 
    const elF = window.el("grace-fields"); 
    if(window.el("credit-grace-check").checked) { elF.classList.remove("hidden"); elF.style.display="flex"; } 
    else { elF.classList.add("hidden"); elF.style.display="none"; } 
};

window.generateExactSchedule = function(amount, startDate, payDay, duration, rate, type, graceDur, graceRate, graceType) {
    let sched = [], bal = amount; let dDate = new Date(startDate);
    let totalInterest = 0, totalPrincipal = 0;

    for(let i=1; i<=duration; i++) {
        let payYear = dDate.getFullYear(), payMonth = dDate.getMonth() + 1; 
        if(payMonth > 11) { payMonth = 0; payYear++; }
        
        let daysInTargetMonth = new Date(payYear, payMonth + 1, 0).getDate();
        let actualPayDay = Math.min(payDay, daysInTargetMonth);
        let pDate = new Date(payYear, payMonth, actualPayDay);

        let daysDiff = Math.round((pDate - dDate) / 86400000);
        let isGrace = i <= graceDur, cRate = isGrace ? graceRate : rate;
        
        let interest = bal * (cRate / 100 / 365) * daysDiff;
        let principal = 0;

        if(isGrace && graceType === 'no_principal') {
            principal = 0;
        } else {
            let activeRem = duration - (isGrace && graceType === 'no_principal' ? graceDur : i) + 1;
            if(activeRem < 1) activeRem = 1;
            let mRate = (cRate / 100) / 12; 
            if(type === 'annuity') {
                let annuitetPay = (bal * (mRate * Math.pow(1+mRate, activeRem)) / (Math.pow(1+mRate, activeRem) - 1));
                principal = annuitetPay - interest; if(principal < 0) principal = 0; 
            } else { principal = bal / activeRem; }
        }

        if(principal > bal || i === duration) principal = bal;
        bal -= principal; totalInterest += interest; totalPrincipal += principal;

        sched.push({ num: i, date: pDate.toISOString().slice(0,10), principal: principal, interest: interest, total: principal + interest, remain: Math.max(0, bal), status: 'unpaid' });
        dDate = pDate; 
    }
    return sched;
};

window.updateCreditAnalysis = () => {
    const btnSave = window.el("btn-save-credit");
    btnSave.classList.add("disabled"); btnSave.style.opacity = "0.5"; btnSave.style.pointerEvents = "none";
    window.tempSchedule = null;

    let a = window.getNum("credit-amount"), initial = window.getNum("credit-initial-fee"), ins = window.getNum("credit-insurance-fee");
    let actualLoan = a - initial + ins;

    const d = parseInt(window.val("credit-duration"))||0, r = parseFloat(window.val("credit-rate")), tp = window.val("credit-type");
    const pd = parseInt(window.val("credit-payday")), startDate = window.val("credit-date");
    const hg = window.el("credit-grace-check").checked, gd = hg ? (parseInt(window.val("credit-grace-dur"))||0) : 0, gr = hg ? (parseFloat(window.val("credit-grace-rate"))||0) : 0, gt = window.val("credit-grace-type");
    const box = window.el("credit-analysis-box");
    
    if(actualLoan <= 0 || !d || r === null || isNaN(r) || !pd || !startDate) { box.innerHTML = "<div style='font-size:11px; color:var(--text-muted); text-align:center;'>Tahlil uchun hamma qatorlarni to'ldiring...</div>"; return; }

    window.tempSchedule = window.generateExactSchedule(actualLoan, startDate, pd, d, r, tp, gd, gr, gt);
    if(window.tempSchedule.length === 0) return;

    let totalPay = window.tempSchedule.reduce((s,i)=>s+i.total, 0), firstPay = window.tempSchedule[0].total, lastPay = window.tempSchedule[window.tempSchedule.length-1].total;
    let payTxt = tp === 'annuity' ? `~${window.formatM(firstPay)}` : `${window.formatM(firstPay)} dan ${window.formatM(lastPay)} gacha`;

    let html = `<div class="analysis-row"><span style="color:var(--text-muted);">Asosiy Qarz:</span> <b>${window.formatM(actualLoan)}</b></div>`;
    if(initial > 0) html += `<div class="analysis-row"><span style="color:var(--text-muted);">Boshlang'ich to'lov:</span> <b style="color:var(--primary);">${window.formatM(initial)}</b></div>`;
    if(ins > 0) html += `<div class="analysis-row"><span style="color:var(--text-muted);">Sug'urta xarajati:</span> <b style="color:var(--danger);">${window.formatM(ins)}</b></div>`;
    
    html += `<div class="analysis-row"><span style="color:var(--text-muted);">Oylik to'lov:</span> <b style="color:var(--warning);">${payTxt}</b></div>`;
    html += `<div class="analysis-row"><span style="color:var(--text-muted);">Jami ustama (Foiz):</span> <b style="color:var(--danger);">${window.formatM(totalPay - actualLoan)}</b></div>`;
    html += `<button onclick="showTempSchedule()" class="btn-primary" style="margin-top:10px; background:transparent; border:1px solid var(--primary); color:var(--primary); font-size:13px; padding:8px;">📊 To'liq Grafikni Ko'rish</button>`;

    box.innerHTML = html;
    btnSave.classList.remove("disabled"); btnSave.style.opacity = "1"; btnSave.style.pointerEvents = "auto";
};

window.showTempSchedule = () => {
    if(!window.tempSchedule) return;
    window.setTxt("schedule-title", "Dastlabki Grafik"); window.setTxt("schedule-info", "Hisob-kitoblar aniq kunlarga asoslangan.");
    let html = "<tr><th>Sana</th><th>Asosiy</th><th>Foiz</th><th>Jami</th></tr>";
    window.tempSchedule.forEach(item => { html += `<tr><td><b>${item.num}</b><br><span style="font-size:9px;color:var(--text-muted)">${item.date}</span></td><td>${window.formatM(item.principal)}</td><td>${window.formatM(item.interest)}</td><td style="color:var(--danger)">${window.formatM(item.total)}</td></tr>`; });
    window.setHtml("schedule-table", html); window.setTxt("schedule-footer", ""); window.openModal("modal-schedule");
};

window.prepareSaveCredit = () => { window.openUniversalConfirm("Haqiqatan ham bu kreditni rasmiylashtirmoqchimisiz? (Grafik ro'yxatga qo'shiladi)", window.saveCreditAction); };

window.saveCreditAction = () => {
    const b = window.val("credit-bank"), tId = window.val("credit-type-name");
    const bankObj = window.BANK_DB[b]; const crObj = bankObj ? bankObj.credits.find(x => x.id === tId) : null;
    const n = (bankObj && crObj) ? `${b} - ${crObj.name}` : "Nomsiz Kredit";
    
    let a = window.getNum("credit-amount"), initial = window.getNum("credit-initial-fee"), ins = window.getNum("credit-insurance-fee"); let actualLoan = a - initial + ins;
    const d=parseInt(window.val("credit-duration")), pd=parseInt(window.val("credit-payday")), r=parseFloat(window.val("credit-rate")), tp=window.val("credit-type"), startDate=window.val("credit-date");
    const hg = window.el("credit-grace-check").checked; const gd = hg ? parseInt(window.val("credit-grace-dur")) : 0, gr = hg ? parseFloat(window.val("credit-grace-rate")) : 0, gt = window.val("credit-grace-type");

    window.state.credits.push({ id:Date.now(), name:n, bankIcon: bankObj.icon, typeIcon: crObj.icon, initAmt:actualLoan, totalCost: a+ins, start:startDate, payDay:pd, duration:d, rate:r, type:tp, graceDur:gd, graceRate:gr, graceType:gt, schedule:window.tempSchedule, extraPrincipalPaid:0, archived:false, closedDate:null });
    window.state.incs.unshift({id:Date.now()+1, amount:actualLoan, desc:`Kredit: ${n}`, cat:"Kredit", date:startDate, time:"00:00", user:window.tgUser, prof:"general"});
    if(window.creditIncomeToReserve) window.creditIncomeToReserve(actualLoan, `Kredit: ${n}`); 
    
    window.setVal("credit-bank",""); window.setVal("credit-type-name",""); window.el("credit-amount").value=""; window.setVal("credit-duration",""); window.el("credit-initial-fee").value=""; window.el("credit-insurance-fee").value=""; window.el("credit-grace-check").checked = false; window.toggleGraceFields(); window.el("credit-analysis-box").innerHTML = "<div style='font-size:11px; color:var(--text-muted); text-align:center;'>Tahlil uchun bank va summani kiriting...</div>"; 
    window.switchCrTab('aktiv'); window.save(); window.toast("Muvaffaqiyatli Saqlandi!");
};

window.openCreditScheduleModal = id => {
    const cr = window.state.credits.find(x=>x.id==id); if(!cr) return;
    window.setTxt("schedule-title", "Kredit Grafigi"); window.setTxt("schedule-info", `${cr.typeIcon||'💳'} ${cr.name} (${window.formatM(cr.initAmt)})\nMuddat: ${cr.duration} oy | Stavka: ${cr.rate}% Yillik\nTuri: ${cr.type==='annuity'?'Annuitet':'Differensial'}${cr.graceDur>0?`\nImtiyoz: ${cr.graceDur} oy (${cr.graceRate}%)`:''}`);
    let html = "<tr><th>Oy/Sana</th><th>Asosiy</th><th>Foiz</th><th>Jami</th><th>Status</th></tr>", totalPay = 0;
    cr.schedule.forEach(item => {
        totalPay += item.total; let statHtml = item.status === 'paid' ? '<span class="status-paid" style="color:var(--success)">To\'landi</span>' : '<span class="status-unpaid" style="color:var(--warning)">Kutilmoqda</span>';
        html += `<tr><td><b>${item.num}</b><br><span style="font-size:9px;color:var(--text-muted)">${item.date}</span></td><td>${window.formatM(item.principal)}</td><td>${window.formatM(item.interest)}</td><td style="color:var(--danger)">${window.formatM(item.total)}</td><td>${statHtml}</td></tr>`;
    });
    window.setHtml("schedule-table", html); window.setTxt("schedule-footer", `Jami to'lanadigan: ${window.formatM(totalPay)}`); window.openModal("modal-schedule");
};

window.payNextMonthCredit = id => {
    const cr = window.state.credits.find(x => x.id == id); const nextUnpaid = cr.schedule.find(x => x.status === 'unpaid'); if(!nextUnpaid) return window.toast("Hamma to'langan!", true);
    window.state.txs.unshift({ id: Date.now(), amount: nextUnpaid.total, desc: `Kredit oylik: ${cr.name}`, cat: "Kredit", date: new Date().toISOString().slice(0,10), time: "00:00", user: window.tgUser, prof: "general" });
    nextUnpaid.status = 'paid'; if(!cr.schedule.find(x => x.status === 'unpaid')) { cr.archived = true; cr.closedDate = new Date().toISOString().slice(0,10); window.toast("Kredit yopildi!"); window.switchCrTab('arxiv'); } else { window.toast("Oylik to'landi!"); } window.save();
};

window.openPrincipalPayModal = id => {
    window.curCreditId = id; const cr = window.state.credits.find(x => x.id == id);
    let paidPrincipal = cr.schedule.filter(x => x.status === 'paid').reduce((s, x) => s + x.principal, 0); let currentBal = cr.initAmt - paidPrincipal - (cr.extraPrincipalPaid || 0);
    window.setTxt("principal-pay-info", `Joriy qarz: ${window.formatM(currentBal)}\nTanidan to'lasangiz kelgusi oylar uchun grafik avtomat qayta hisoblanadi.`); window.el("principal-pay-amount").value=""; window.openModal('modal-principal-pay');
};

window.recalcCreditSchedule = cr => {
    let paidItems = cr.schedule.filter(x => x.status === 'paid'), unpaidItems = cr.schedule.filter(x => x.status === 'unpaid'); if(unpaidItems.length === 0) return;
    let currentBal = cr.initAmt - paidItems.reduce((s, x) => s + x.principal, 0) - (cr.extraPrincipalPaid || 0);
    if (currentBal <= 0) { unpaidItems.forEach(x => { x.principal=0; x.interest=0; x.total=0; x.remain=0; x.status='paid'; }); cr.closedDate = new Date().toISOString().slice(0,10); cr.archived = true; return; }
    let tempSched = window.generateExactSchedule(currentBal, cr.start, cr.payDay, cr.duration, cr.rate, cr.type, cr.graceDur, cr.graceRate, cr.graceType);
    for(let i=0; i<unpaidItems.length; i++) { if(tempSched[i]) { unpaidItems[i].principal = tempSched[i].principal; unpaidItems[i].interest = tempSched[i].interest; unpaidItems[i].total = tempSched[i].total; unpaidItems[i].remain = tempSched[i].remain; } }
};

window.confirmPrincipalPay = () => {
    let amt = window.getNum("principal-pay-amount"); if(!amt || amt <= 0) return window.toast("Xato", true); const cr = window.state.credits.find(x => x.id == window.curCreditId);
    let currentBal = cr.initAmt - cr.schedule.filter(x => x.status === 'paid').reduce((s, x) => s + x.principal, 0) - (cr.extraPrincipalPaid || 0);
    if (amt > currentBal) amt = currentBal; cr.extraPrincipalPaid = (cr.extraPrincipalPaid || 0) + amt;
    window.state.txs.unshift({ id: Date.now(), amount: amt, desc: `Kredit tanidan: ${cr.name}`, cat: "Kredit", date: new Date().toISOString().slice(0,10), time: "00:00", user: window.tgUser, prof: "general" });
    window.recalcCreditSchedule(cr); window.closeModal('modal-principal-pay'); window.save(); window.toast("Tanidan to'landi!");
};

window.closeCredit = id => {
    window.openUniversalConfirm("Kreditni butunlay yopmoqchimisiz? Qolgan summa yechib olinadi.", () => {
        const cr = window.state.credits.find(x=>x.id==id); if(!cr) return;
        let currentBal = cr.initAmt - cr.schedule.filter(x => x.status === 'paid').reduce((s, x) => s + x.principal, 0) - (cr.extraPrincipalPaid || 0);
        if(currentBal > 0) { window.state.txs.unshift({id:Date.now(), amount:currentBal, desc:`Kredit yopildi: ${cr.name}`, cat:"Kredit", date:new Date().toISOString().slice(0,10), time:"00:00", user:window.tgUser, prof:"general"}); cr.extraPrincipalPaid = (cr.extraPrincipalPaid||0) + currentBal; window.recalcCreditSchedule(cr); }
        cr.archived = true; cr.closedDate = new Date().toISOString().slice(0,10); window.save(); window.switchCrTab('arxiv'); window.toast("Yopildi!");
    });
};

window.permDelCredit = id => {
    window.openUniversalConfirm("Kreditni butunlay arxivdan o'chirib yubormoqchimisiz? Uni qayta tiklab bo'lmaydi.", () => { window.state.credits = window.state.credits.filter(x=>x.id!=id); window.save(); window.switchCrTab('arxiv'); window.toast("O'chirildi!"); });
};
