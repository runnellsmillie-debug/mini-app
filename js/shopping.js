// ==========================================
// SHOPPING.JS - Bozorlik ro'yxati mantiqi
// ==========================================

// --- TABLARNI BOSHQARISH ---
window.switchPlanTab = (tab) => {
    ['add', 'active', 'skip', 'history'].forEach(t => {
        let btn = window.el('plan-tab-' + t); 
        let view = window.el('plan-view-' + t);
        if(btn && view) { 
            if(t === tab) { 
                btn.style.background = 'var(--primary)'; 
                btn.style.borderColor = 'var(--primary)'; 
                view.classList.remove('hidden'); 
            } else { 
                btn.style.background = 'var(--bg-card)'; 
                btn.style.borderColor = 'var(--border-color)'; 
                view.classList.add('hidden'); 
            } 
        }
    });
    // Boshqa tabga o'tganda ma'lumotlarni yangilab ko'rsatish
    if(tab !== 'add') window.renderPlanned();
};

// --- KATEGORIYALAR VA TEGLAR ---
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

// --- QO'SHISH AMALLARI ---
window.quickAddPlan = t => { 
    const ni = window.el("plan-name"), qi = window.el("plan-qty"); ni.value = t; qi.value = ""; 
    ni.style.borderColor = "var(--success)"; setTimeout(() => ni.style.borderColor = "var(--border-color)", 600); 
    qi.focus(); window.toast("Hajmini yozing"); 
};

window.addPlannedItemManual = () => { 
    const n = window.val("plan-name").trim(), q = window.val("plan-qty").trim(), c = window.val("smart-plan-cat"), m = window.val("plan-market"), p = window.getNum("plan-price"); 
    if(!n) return window.toast("Nomi kerak!", true); 
    // Yangi qo'shilgan element default holatda skip: false va archived: false bo'ladi
    window.state.plan.push({ id: Date.now(), text: q ? `${n} (${q})` : n, cat: c, market: m, price: p, prof: window.curProf, skip: false, archived: false }); 
    window.setVal("plan-name",""); window.setVal("plan-qty",""); window.el("plan-price").value=""; 
    window.save(); 
    window.toast("Faol ro'yxatga tushdi!"); 
};

// --- STATUSNI O'ZGARTIRISH (Kechiktirish / Qaytarish) ---
window.skipPlanItem = id => { 
    const i = window.state.plan.find(x=>x.id==id); 
    if(i) { i.skip = true; window.save(); window.renderPlanned(); window.toast("Kechiktirildi ⏳"); } 
};

window.unskipPlanItem = id => { 
    const i = window.state.plan.find(x=>x.id==id); 
    if(i) { i.skip = false; window.save(); window.renderPlanned(); window.toast("Ro'yxatga qaytdi ✅"); } 
};

window.permDelPlan = id => { 
    window.openUniversalConfirm("Tarixdan butunlay o'chirib yubormoqchimisiz?", () => {
        window.state.plan = window.state.plan.filter(x=>x.id!=id); 
        window.save(); window.renderPlanned(); window.toast("O'chirildi!");
    });
};

// --- SOTIB OLISH ---
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
    // Asosiy byudjetdan pul yechiladi
    window.state.txs.unshift({ id: Date.now(), amount: p, desc: i.text, cat: i.cat, subCat: i.market, date: d.toISOString().slice(0,10), time: d.toLocaleTimeString("uz-UZ", {hour:'2-digit', minute:'2-digit'}), user: window.tgUser, prof: i.prof }); 
    // Arxivlanadi
    i.archived = true; i.skip = false; i.buyPrice = p; i.buyDate = d.toISOString().slice(0,10); 
    window.closeModal("modal-buy"); window.save(); window.renderPlanned(); window.toast("Xarid qilindi ✅"); 
};

// --- EKRANGA CHIQARISH (RENDER) ---
window.renderPlanned = function() {
    const allUserPlans = window.state.plan.filter(x => x.prof === window.curProf || window.curProf === "general" || (window.curProf === "home_profile" && x.prof === "home_profile"));
    
    // 3 xil holat uchun filtrlash
    const active = allUserPlans.filter(x => !x.archived && !x.skip);
    const skipped = allUserPlans.filter(x => !x.archived && x.skip);
    const history = allUserPlans.filter(x => x.archived).sort((a,b) => b.id - a.id); // Tarix yangilari tepada

    // --- 1. FAOL RO'YXATNI CHIZISH ---
    const fc = window.val("filter-cat"), fm = window.val("filter-market");
    let filteredActive = active;
    if(fc && fc!=="all") filteredActive = filteredActive.filter(x=>x.cat===fc); 
    if(fm && fm!=="all") filteredActive = filteredActive.filter(x=>x.market===fm);

    let activeGroups = filteredActive.reduce((acc, item) => {
        if(!acc[item.cat]) acc[item.cat] = [];
        acc[item.cat].push(item);
        return acc;
    }, {});

    let htmlActive = "";
    for(let cat in activeGroups) {
        htmlActive += `<div style="margin-bottom:15px; background:var(--bg-dark); padding:10px; border-radius:12px; border:1px solid var(--border-color); box-shadow:0 4px 6px rgba(0,0,0,0.1);">
            <div style="color:var(--primary); font-weight:bold; margin-bottom:8px; font-size:14px; border-bottom:1px dashed var(--border-color); padding-bottom:5px;">
                ${window.CAT_ICONS[cat] || '📦'} ${cat.replace(/_/g, ' ')}
            </div>
            ${activeGroups[cat].map(x => `
                <div class="plan-item" style="border:none; border-bottom:1px solid var(--border-color); border-radius:0; padding:8px 0; margin-bottom:0; background:transparent;">
                    <div style="flex:1;">
                        <div style="font-weight:bold; color:var(--text-main); font-size:14px;">${x.text}</div>
                        <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">📍 ${x.market} | 💰 ${window.formatM(x.price)}</div>
                    </div>
                    <div style="display:flex; gap:5px; flex-direction:column;">
                        <button onclick="openBuyModal(${x.id})" class="btn-primary btn-success" style="width:auto; padding:5px 15px; font-size:12px; margin:0;">Olish</button>
                        <button onclick="skipPlanItem(${x.id})" class="btn-primary" style="width:auto; padding:4px 15px; font-size:11px; margin:0; background:var(--bg-card); border:1px solid var(--warning); color:var(--warning);">⏳ Kechiktirish</button>
                    </div>
                </div>
            `).join('')}
        </div>`;
    }
    window.setHtml("planned-list-active", htmlActive || "<div style='text-align:center; color:var(--text-muted); font-size:13px; margin-top:15px;'>Bozorlik ro'yxati bo'sh.</div>");

    // --- 2. KECHIKTIRILGANLARNI CHIZISH ---
    let htmlSkipped = skipped.map(x => `
        <div class="list-item" style="border-left: 5px solid var(--warning); flex-direction:column; align-items:flex-start;">
            <div style="display:flex; justify-content:space-between; width:100%;">
                <div>
                    <div style="font-size:15px; font-weight:bold; color:var(--warning);">${x.text}</div>
                    <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">📍 ${x.market} | 🏷️ ${x.cat.replace(/_/g,' ')}</div>
                </div>
                <div style="font-weight:bold; font-size:15px; color:var(--text-muted); text-decoration:line-through;">${window.formatM(x.price)}</div>
            </div>
            <button onclick="unskipPlanItem(${x.id})" class="btn-primary" style="width:100%; background:transparent; border:1px dashed var(--success); color:var(--success); padding:8px; font-size:12px; margin-top:10px; margin-bottom:0;">⤴️ Faol ro'yxatga qaytarish</button>
        </div>
    `).join("");
    window.setHtml("planned-list-skipped", htmlSkipped || "<div style='text-align:center; color:var(--text-muted); font-size:13px; margin-top:15px;'>Kechiktirilgan mahsulotlar yo'q.</div>");

    // --- 3. XARID TARIXINI CHIZISH ---
    let htmlHistory = history.map(x => `
        <div class="list-item" style="border-left: 5px solid var(--text-muted); flex-direction:column; align-items:flex-start; filter: grayscale(100%);">
            <div style="display:flex; justify-content:space-between; width:100%;">
                <div>
                    <div style="font-size:15px; font-weight:bold; color:var(--text-muted); text-decoration:line-through;">${x.text}</div>
                    <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">Olingan: ${x.buyDate || ''} | 📍 ${x.market}</div>
                </div>
                <div style="font-weight:bold; font-size:15px; color:var(--text-muted);">${window.formatM(x.buyPrice || x.price)}</div>
            </div>
            <button onclick="permDelPlan(${x.id})" class="btn-primary" style="width:100%; background:transparent; border:1px solid var(--danger); color:var(--danger); padding:8px; font-size:12px; margin-top:10px; margin-bottom:0;">🗑️ Butunlay o'chirish</button>
        </div>
    `).join("");
    window.setHtml("planned-list-history", htmlHistory || "<div style='text-align:center; color:var(--text-muted); font-size:13px; margin-top:15px;'>Tarix bo'sh.</div>");
};
