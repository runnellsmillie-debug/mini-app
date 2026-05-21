// ==========================================
// SHOPPING.JS - Bozorlik ro'yxati mantiqi
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

// Kategoriyalar bilan chiroyli karta uslubida chiqarish
window.renderPlanned = function() {
    const active = window.state.plan.filter(x => !x.archived && (x.prof === window.curProf || window.curProf === "general" || (window.curProf === "home_profile" && x.prof === "home_profile")));
    const fc = window.val("filter-cat"), fm = window.val("filter-market"), t = new Date().toISOString().slice(0,10);
    
    let filtered = active;
    if(fc && fc!=="all") filtered = filtered.filter(x=>x.cat===fc); 
    if(fm && fm!=="all") filtered = filtered.filter(x=>x.market===fm);

    let groups = filtered.reduce((acc, item) => {
        if(!acc[item.cat]) acc[item.cat] = [];
        acc[item.cat].push(item);
        return acc;
    }, {});

    let html = "";
    for(let cat in groups) {
        html += `<div style="margin-bottom:15px; background:var(--bg-dark); padding:10px; border-radius:12px; border:1px solid var(--border-color); box-shadow:0 4px 6px rgba(0,0,0,0.1);">
            <div style="color:var(--primary); font-weight:bold; margin-bottom:8px; font-size:14px; border-bottom:1px dashed var(--border-color); padding-bottom:5px;">
                ${window.CAT_ICONS[cat] || '📦'} ${cat.replace(/_/g, ' ')}
            </div>
            ${groups[cat].map(x => {
                const sk = x.skip === t;
                return `<div class="plan-item ${sk?'skipped':''}" style="border:none; border-bottom:1px solid var(--border-color); border-radius:0; padding:8px 0; margin-bottom:0; background:transparent;">
                    <div class="custom-checkbox ${!sk?'checked':''}" onclick="toggleSkipPlan(${x.id})"></div>
                    <div style="flex:1;">
                        <div style="font-weight:bold; color:var(--text-main); font-size:14px; text-decoration:${sk?'line-through':'none'};">${x.text}</div>
                        <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">📍 ${x.market} | 💰 ${window.formatM(x.price)}</div>
                    </div>
                    <button onclick="openBuyModal(${x.id})" class="btn-primary btn-success" style="width:auto; padding:6px 12px; font-size:12px; margin-bottom:0;" ${sk?'disabled':''}>Olish</button>
                </div>`;
            }).join('')}
        </div>`;
    }
    
    window.setHtml("planned-list-container", html || "<div style='text-align:center; color:var(--text-muted); font-size:13px; margin-top:15px;'>Bozorlik ro'yxati bo'sh.</div>");
};
