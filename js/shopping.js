// ==========================================
// SHOPPING.JS - Bozorlik ro'yxati mantiqi (Aqlli tizim)
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

// --- QO'SHISH VA AVTO-NARX (YANGI) ---
window.getHistoricalPrice = (name) => {
    // Tarixdan narxi bor bo'lgan va nomi mos kelgan eng so'nggi mahsulotni topish
    const pastItems = window.state.plan.filter(x => x.archived && x.text.toLowerCase().includes(name.toLowerCase()) && (x.buyPrice || x.price));
    if(pastItems.length > 0) {
        // Eng oxirgi olinganini olish (ID bo'yicha eng kattasi)
        pastItems.sort((a,b) => b.id - a.id);
        return pastItems[0].buyPrice || pastItems[0].price;
    }
    return 0;
};

window.quickAddPlan = t => { 
    const ni = window.el("plan-name"), qi = window.el("plan-qty"), pi = window.el("plan-price"); 
    ni.value = t; qi.value = ""; 
    
    // Avtomatik narx qidirish
    let autoPrice = window.getHistoricalPrice(t);
    if(autoPrice > 0) {
        pi.value = new Intl.NumberFormat('ru-RU').format(autoPrice).replace(/,/g, ' ');
    } else {
        pi.value = "";
    }

    ni.style.borderColor = "var(--success)"; setTimeout(() => ni.style.borderColor = "var(--border-color)", 600); 
    qi.focus(); window.toast(autoPrice > 0 ? "Narx tarixdan olindi!" : "Hajmini yozing"); 
};

window.addPlannedItemManual = () => { 
    const n = window.val("plan-name").trim(), q = window.val("plan-qty").trim(), c = window.val("smart-plan-cat"), m = window.val("plan-market"); 
    let p = window.getNum("plan-price"); 
    
    if(!n) return window.toast("Nomi kerak!", true); 
    
    // Agar narx kiritilmagan bo'lsa, tarixdan yana bir marta izlab ko'ramiz
    if(!p || p === 0) p = window.getHistoricalPrice(n);

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
    window.state.txs.unshift({ id: Date.now(), amount: p, desc: i.text, cat: i.cat, subCat: i.market, date: d.toISOString().slice(0,10), time: d.toLocaleTimeString("uz-UZ", {hour:'2-digit', minute:'2-digit'}), user: window.tgUser, prof: i.prof }); 
    i.archived = true; i.skip = false; i.buyPrice = p; i.buyDate = d.toISOString().slice(0,10); 
    window.closeModal("modal-buy"); window.save(); window.renderPlanned(); window.toast("Xarid qilindi ✅"); 
};

// --- TARIY OYNALARINI OCHIB-YOPISH ---
window.toggleHistoryDate = (dateId) => {
    const el = window.el('hist-' + dateId);
    const arrow = window.el('hist-arrow-' + dateId);
    if(el.classList.contains('hidden')) {
        el.classList.remove('hidden');
        if(arrow) arrow.innerText = '▼';
    } else {
        el.classList.add('hidden');
        if(arrow) arrow.innerText = '▶';
    }
};

// --- ASOSIY EKRANGA CHIQARISH (RENDER) ---
window.renderPlanned = function() {
    const allUserPlans = window.state.plan.filter(x => x.prof === window.curProf || window.curProf === "general" || (window.curProf === "home_profile" && x.prof === "home_profile"));
    const fc = window.val("filter-cat"), fm = window.val("filter-market");

    // Yordamchi funksiya: Guruhlash va yig'indi hisoblash
    const renderGroupedList = (items, isSkippedMode = false) => {
        let filtered = items;
        if(fc && fc!=="all") filtered = filtered.filter(x=>x.cat===fc); 
        if(fm && fm!=="all") filtered = filtered.filter(x=>x.market===fm);

        let groups = {}; let grandTotal = 0;
        filtered.forEach(item => {
            if(!groups[item.cat]) groups[item.cat] = { list: [], total: 0 };
            groups[item.cat].list.push(item);
            groups[item.cat].total += (item.price || 0);
            grandTotal += (item.price || 0);
        });

        if(Object.keys(groups).length === 0) return { html: "", grandTotal: 0 };

        let html = "";
        for(let cat in groups) {
            html += `<div style="margin-bottom:15px; background:var(--bg-dark); padding:10px; border-radius:12px; border:1px solid var(--border-color); box-shadow:0 4px 6px rgba(0,0,0,0.1);">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed var(--border-color); padding-bottom:5px; margin-bottom:8px;">
                    <span style="color:var(--primary); font-weight:bold; font-size:14px;">${window.CAT_ICONS[cat] || '📦'} ${cat.replace(/_/g, ' ')}</span>
                    <span style="color:var(--warning); font-size:13px; font-weight:bold;">${window.formatM(groups[cat].total)}</span>
                </div>
                ${groups[cat].list.map(x => `
                    <div class="plan-item" style="border:none; border-bottom:1px solid var(--border-color); border-radius:0; padding:8px 0; margin-bottom:0; background:transparent;">
                        <div style="flex:1;">
                            <div style="font-weight:bold; color:var(--text-main); font-size:14px;">${x.text}</div>
                            <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">📍 ${x.market} | 💰 ${window.formatM(x.price || 0)}</div>
                        </div>
                        <div style="display:flex; gap:5px; flex-direction:column;">
                            ${isSkippedMode ? 
                                `<button onclick="unskipPlanItem(${x.id})" class="btn-primary" style="width:auto; padding:5px 15px; font-size:11px; margin:0; background:transparent; border:1px dashed var(--success); color:var(--success);">⤴️ Qaytarish</button>` 
                                : 
                                `<button onclick="openBuyModal(${x.id})" class="btn-primary btn-success" style="width:auto; padding:5px 15px; font-size:12px; margin:0;">Olish</button>
                                 <button onclick="skipPlanItem(${x.id})" class="btn-primary" style="width:auto; padding:4px 15px; font-size:11px; margin:0; background:var(--bg-card); border:1px solid var(--warning); color:var(--warning);">⏳ Kechiktirish</button>`
                            }
                        </div>
                    </div>
                `).join('')}
            </div>`;
        }
        return { html, grandTotal };
    };

    // --- 1. FAOL RO'YXAT (Aktiv) ---
    const activeData = renderGroupedList(allUserPlans.filter(x => !x.archived && !x.skip));
    let finalActiveHtml = "";
    if(activeData.grandTotal > 0) {
        finalActiveHtml += `<div style="background:rgba(59, 130, 246, 0.1); border:1px solid var(--primary); padding:12px; border-radius:12px; text-align:center; margin-bottom:15px;">
            <div style="font-size:11px; color:var(--text-muted);">JAMI KUTILAYOTGAN XARAJAT</div>
            <div style="font-size:20px; font-weight:bold; color:var(--primary);">${window.formatM(activeData.grandTotal)}</div>
        </div>`;
    }
    window.setHtml("planned-list-active", finalActiveHtml + (activeData.html || "<div style='text-align:center; color:var(--text-muted); font-size:13px; margin-top:15px;'>Bozorlik ro'yxati bo'sh.</div>"));

    // --- 2. KECHIKTIRILGANLAR (Skip) - Endi u ham guruhlanadi ---
    const skipData = renderGroupedList(allUserPlans.filter(x => !x.archived && x.skip), true);
    let finalSkipHtml = "";
    if(skipData.grandTotal > 0) {
        finalSkipHtml += `<div style="background:rgba(245, 158, 11, 0.1); border:1px solid var(--warning); padding:10px; border-radius:12px; text-align:center; margin-bottom:15px;">
            <div style="font-size:11px; color:var(--text-muted);">KECHIKTIRILGAN JAMI SUMMA</div>
            <div style="font-size:18px; font-weight:bold; color:var(--warning);">${window.formatM(skipData.grandTotal)}</div>
        </div>`;
    }
    window.setHtml("planned-list-skipped", finalSkipHtml + (skipData.html || "<div style='text-align:center; color:var(--text-muted); font-size:13px; margin-top:15px;'>Kechiktirilgan mahsulotlar yo'q.</div>"));

    // --- 3. XARID TARIXI (Sana bo'yicha guruhlash) ---
    const historyItems = allUserPlans.filter(x => x.archived).sort((a,b) => b.id - a.id);
    let historyGroups = {};
    historyItems.forEach(item => {
        let dateKey = item.buyDate || 'Noma\'lum sana';
        if(!historyGroups[dateKey]) historyGroups[dateKey] = { list: [], total: 0 };
        historyGroups[dateKey].list.push(item);
        historyGroups[dateKey].total += (item.buyPrice || item.price || 0);
    });

    let htmlHistory = "";
    for(let date in historyGroups) {
        let safeDateId = window.slugify(date);
        htmlHistory += `<div style="margin-bottom:10px; background:var(--bg-card); border-radius:12px; border:1px solid var(--border-color); overflow:hidden;">
            <div onclick="toggleHistoryDate('${safeDateId}')" style="display:flex; justify-content:space-between; align-items:center; padding:12px 15px; cursor:pointer; background:rgba(255,255,255,0.02);">
                <div style="font-weight:bold; font-size:14px; color:var(--text-main);">📅 ${date} <span id="hist-arrow-${safeDateId}" style="font-size:10px; margin-left:8px; color:var(--text-muted);">▶</span></div>
                <div style="font-weight:bold; color:var(--danger);">${window.formatM(historyGroups[date].total)}</div>
            </div>
            
            <div id="hist-${safeDateId}" class="hidden" style="padding:0 15px 10px 15px; border-top:1px dashed var(--border-color);">
                ${historyGroups[date].list.map(x => `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
                        <div>
                            <div style="font-size:13px; color:var(--text-main);">${x.text}</div>
                            <div style="font-size:10px; color:var(--text-muted); margin-top:2px;">🏷️ ${x.cat.replace(/_/g,' ')} | 📍 ${x.market}</div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:13px; font-weight:bold; color:var(--text-muted);">${window.formatM(x.buyPrice || x.price)}</div>
                            <button onclick="permDelPlan(${x.id})" style="background:none; border:none; color:var(--danger); font-size:14px; padding:2px 0 0 0; cursor:pointer;">🗑️</button>
                        </div>
                    </div>
                `).join("")}
            </div>
        </div>`;
    }
    window.setHtml("planned-list-history", htmlHistory || "<div style='text-align:center; color:var(--text-muted); font-size:13px; margin-top:15px;'>Tarix bo'sh.</div>");
};
