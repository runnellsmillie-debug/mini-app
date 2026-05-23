// ==========================================
// SHOPPING.JS - Bozorlik ro'yxati mantiqi
// ==========================================

window.switchPlanTab = (tab) => {
    ['add', 'active', 'skip', 'history'].forEach(t => {
        let btn = window.el('plan-tab-' + t);
        let view = window.el('plan-view-' + t);
        if (btn && view) {
            if (t === tab) {
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
    if (tab !== 'add') window.renderPlanned();
};

window.selectPlanCat = (cat) => {
    window.setVal("smart-plan-cat", cat);
    window.ctxDetailLabel = (cat || "").replace(/_/g, " ");
    if (window.updateSubViewContext) window.updateSubViewContext();
    window.renderPlanCatChips();
    window.updateSmartTags();
};

window.renderPlanCatChips = () => {
    const wrap = window.el("plan-cat-chips");
    const sel = window.el("smart-plan-cat");
    if (!wrap || !sel) return;
    const cur = window.val("smart-plan-cat");
    const opts = Array.from(sel.options).map(o => o.value);
    wrap.innerHTML = opts.map(c => {
        const label = c.replace(/_/g, " ");
        const icon = window.CAT_ICONS[c] || "📦";
        const active = c === cur ? " plan-cat-chip--active" : "";
        return `<button type="button" class="plan-cat-chip${active}" onclick="window.selectPlanCat('${c.replace(/'/g, "\\'")}')">${icon} ${label}</button>`;
    }).join("");
};

window.updatePlanCats = () => {
    const cEl = window.el("smart-plan-cat");
    if (!cEl) return;
    const p = window.state.profiles.find(x => x.id === window.curProf);
    let c = Object.keys(window.PLAN_TAGS || {});
    if (p?.id === "home_profile") c = ["Oziq-ovqat", "Uy_Xojalik"];
    else if (p && p.age != null && p.age <= 6) c = ["Oyinchoq", "Bolalar", "Talim", "Kiyim", "Oziq-ovqat"].filter(x => c.includes(x) || c.some(k => k.includes(x.split('_')[0])));
    else if (p && p.age != null && p.age < 16) c = ["Kiyim", "Talim", "Oyinchoq", "Oziq-ovqat"].filter(x => c.includes(x));
    if (p && p.permissions && p.permissions.length && !p.permissions.includes("admin_all")) {
        const allow = [];
        if (p.permissions.includes("shop_food")) allow.push("Oziq-ovqat", "Uy_Xojalik");
        if (p.permissions.includes("shop_clothes")) allow.push("Kiyim");
        if (p.permissions.includes("shop_school")) allow.push("Talim");
        if (allow.length) c = c.filter(x => allow.some(a => x.includes(a) || a.includes(x)));
    }
    if (!c.length) c = Object.keys(window.PLAN_TAGS || {});
    const prev = window.val("smart-plan-cat");
    cEl.innerHTML = c.map(x => `<option value="${x}">${x.replace(/_/g, ' ')}</option>`).join("");
    if (prev && c.includes(prev)) window.setVal("smart-plan-cat", prev);
    else if (c.length) window.selectPlanCat(c[0]);
    window.renderPlanCatChips();
    window.updateSmartTags();
};

window.updateSmartTags = () => {
    const cat = window.val("smart-plan-cat");
    const subEl = window.el("smart-plan-subcat");
    if (!cat || !subEl) return;
    subEl.innerHTML = "";
    if (window.PLAN_TAGS[cat]) {
        window.show("smart-plan-subcat");
        Object.keys(window.PLAN_TAGS[cat]).forEach(s => {
            subEl.innerHTML += `<option value="${s}">${s.replace(/_/g, '/')}</option>`;
        });
    } else window.hide("smart-plan-subcat");
    window.renderSmartTags();
};

window.renderSmartTags = () => {
    const c = window.val("smart-plan-cat");
    const s = window.val("smart-plan-subcat");
    const cont = window.el("smart-tags-container");
    if (!cont) return;
    cont.innerHTML = "";
    if (window.PLAN_TAGS[c] && window.PLAN_TAGS[c][s]) {
        window.PLAN_TAGS[c][s].forEach(t => {
            cont.innerHTML += `<div class="smart-tag" onclick="window.quickAddPlan('${t.replace(/'/g, "\\'")}')">${t}</div>`;
        });
    } else cont.innerHTML = "<span style='color:var(--text-muted); font-size:12px;'>Tez tanlash yo'q.</span>";
};

window.getHistoricalPrice = (name) => {
    const pastItems = window.state.plan.filter(x => x.archived && x.text.toLowerCase().includes(name.toLowerCase()) && (x.buyPrice || x.price));
    if (pastItems.length > 0) {
        pastItems.sort((a, b) => b.id - a.id);
        return pastItems[0].buyPrice || pastItems[0].price;
    }
    return 0;
};

window.syncPlanPriceDisplay = () => {
    let displayVal = "0";
    if (window.planPriceStr) {
        displayVal = parseInt(window.planPriceStr, 10).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    }
    window.setTxt("plan-num-display", displayVal);
    if (window.el("plan-price")) window.el("plan-price").value = window.planPriceStr;
};

window.pressPlanNum = v => {
    if (v === "C") window.planPriceStr = "";
    else if (v === "⌫") window.planPriceStr = window.planPriceStr.slice(0, -1);
    else if (window.planPriceStr.length < 12) window.planPriceStr += v;
    window.syncPlanPriceDisplay();
};

window.focusPlanPrice = () => {
    const disp = window.el("plan-num-display");
    if (disp) {
        disp.classList.add("num-display--active");
        setTimeout(() => disp.scrollIntoView({ behavior: "smooth", block: "nearest" }), 80);
    }
};

window.quickAddPlan = t => {
    const ni = window.el("plan-name");
    const qi = window.el("plan-qty");
    let autoPrice = window.getHistoricalPrice(t);
    if (ni) {
        ni.value = t;
        ni.style.borderColor = "var(--success)";
        setTimeout(() => { ni.style.borderColor = "var(--border-color)"; }, 600);
    }
    if (qi) qi.value = "";
    window.planPriceStr = autoPrice > 0 ? String(autoPrice) : "";
    window.syncPlanPriceDisplay();
    window.focusPlanPrice();
    window.toast(autoPrice > 0 ? "Narx tarixdan olindi" : "Summani kiriting");
};

window.addPlannedItemManual = () => {
    const n = window.val("plan-name").trim();
    const q = window.val("plan-qty").trim();
    const c = window.val("smart-plan-cat");
    const m = window.val("plan-market");
    let p = parseInt(window.planPriceStr || "0", 10) || window.getNum("plan-price");

    if (!n) return window.toast("Nomi kerak!", true);
    if (!p || p === 0) p = window.getHistoricalPrice(n);
    if (!p) return window.toast("Summani kiriting!", true);

    window.state.plan.push({
        id: Date.now(),
        text: q ? `${n} (${q})` : n,
        cat: c,
        market: m,
        price: p,
        prof: window.curProf,
        skip: false,
        archived: false
    });
    window.setVal("plan-name", "");
    window.setVal("plan-qty", "");
    window.planPriceStr = "";
    window.syncPlanPriceDisplay();
    window.save();
    window.toast("Ro'yxatga qo'shildi!");
};

window.skipPlanItem = id => {
    const i = window.state.plan.find(x => x.id == id);
    if (i) { i.skip = true; window.save(); window.renderPlanned(); window.toast("Kechiktirildi ⏳"); }
};

window.unskipPlanItem = id => {
    const i = window.state.plan.find(x => x.id == id);
    if (i) { i.skip = false; window.save(); window.renderPlanned(); window.toast("Ro'yxatga qaytdi ✅"); }
};

window.permDelPlan = id => {
    window.openUniversalConfirm("Tarixdan butunlay o'chirib yubormoqchimisiz?", () => {
        window.state.plan = window.state.plan.filter(x => x.id != id);
        window.save();
        window.renderPlanned();
        window.toast("O'chirildi!");
    });
};

window.openBuyModal = id => {
    const i = window.state.plan.find(x => x.id == id);
    if (!i) return;
    window.buyPlanId = id;
    window.setTxt("buy-item-name", `✅ Olinyapti: ${i.text}`);
    window.el("buy-price").value = i.price ? new Intl.NumberFormat('ru-RU').format(i.price).replace(/,/g, ' ') : "";
    window.openModal("modal-buy");
};

window.confirmBuyItem = () => {
    const p = window.getNum("buy-price");
    if (!p || p <= 0) return window.toast("Narx xato!", true);
    const i = window.state.plan.find(x => x.id == window.buyPlanId);
    if (!i) return;
    const d = new Date();
    window.state.txs.unshift({
        id: Date.now(), amount: p, desc: i.text, cat: i.cat, subCat: i.market,
        date: d.toISOString().slice(0, 10),
        time: d.toLocaleTimeString("uz-UZ", { hour: '2-digit', minute: '2-digit' }),
        user: window.tgUser, prof: i.prof
    });
    i.archived = true;
    i.skip = false;
    i.buyPrice = p;
    i.buyDate = d.toISOString().slice(0, 10);
    window.closeModal("modal-buy");
    window.save();
    window.renderPlanned();
    window.toast("Xarid qilindi ✅");
};

window.toggleHistoryDate = (dateId) => {
    const el = window.el('hist-' + dateId);
    const arrow = window.el('hist-arrow-' + dateId);
    if (el.classList.contains('hidden')) {
        el.classList.remove('hidden');
        if (arrow) arrow.innerText = '▼';
    } else {
        el.classList.add('hidden');
        if (arrow) arrow.innerText = '▶';
    }
};

window.renderPlanned = function() {
    const allUserPlans = window.state.plan.filter(x => x.prof === window.curProf || window.curProf === "general" || (window.curProf === "home_profile" && x.prof === "home_profile"));
    const fc = window.val("filter-cat");
    const fm = window.val("filter-market");

    const renderGroupedList = (items, isSkippedMode = false) => {
        let filtered = items;
        if (fc && fc !== "all") filtered = filtered.filter(x => x.cat === fc);
        if (fm && fm !== "all") filtered = filtered.filter(x => x.market === fm);

        let groups = {};
        let grandTotal = 0;
        filtered.forEach(item => {
            if (!groups[item.cat]) groups[item.cat] = { list: [], total: 0 };
            groups[item.cat].list.push(item);
            groups[item.cat].total += (item.price || 0);
            grandTotal += (item.price || 0);
        });

        if (Object.keys(groups).length === 0) return { html: "", grandTotal: 0 };

        let html = "";
        for (let cat in groups) {
            html += `<div class="plan-group-box">
                <div class="plan-group-head">
                    <span>${window.CAT_ICONS[cat] || '📦'} ${cat.replace(/_/g, ' ')}</span>
                    <span>${window.formatM(groups[cat].total)}</span>
                </div>
                ${groups[cat].list.map(x => `
                    <div class="plan-item plan-item--flat">
                        <div style="flex:1;">
                            <div style="font-weight:600; font-size:14px;">${x.text}</div>
                            <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">📍 ${x.market} | 💰 ${window.formatM(x.price || 0)}</div>
                        </div>
                        <div style="display:flex; gap:5px; flex-direction:column;">
                            ${isSkippedMode ?
                                `<button onclick="unskipPlanItem(${x.id})" class="btn-primary" style="width:auto; padding:5px 15px; font-size:11px; margin:0; background:transparent; border:1px dashed var(--success); color:var(--success);">⤴️ Qaytarish</button>`
                                :
                                `<button onclick="openBuyModal(${x.id})" class="btn-primary btn-success" style="width:auto; padding:5px 15px; font-size:12px; margin:0;">Olish</button>
                                 <button onclick="skipPlanItem(${x.id})" class="btn-primary" style="width:auto; padding:4px 15px; font-size:11px; margin:0; background:var(--bg-card); border:1px solid var(--warning); color:var(--warning);">⏳ Kech</button>`
                            }
                        </div>
                    </div>
                `).join('')}
            </div>`;
        }
        return { html, grandTotal };
    };

    const activeData = renderGroupedList(allUserPlans.filter(x => !x.archived && !x.skip));
    let finalActiveHtml = "";
    if (activeData.grandTotal > 0) {
        finalActiveHtml += `<div class="plan-summary-banner plan-summary-banner--primary">
            <div>Jami kutilayotgan</div>
            <div>${window.formatM(activeData.grandTotal)}</div>
        </div>`;
    }
    window.setHtml("planned-list-active", finalActiveHtml + (activeData.html || "<div class='empty-state'>Bozorlik ro'yxati bo'sh.</div>"));

    const skipData = renderGroupedList(allUserPlans.filter(x => !x.archived && x.skip), true);
    let finalSkipHtml = "";
    if (skipData.grandTotal > 0) {
        finalSkipHtml += `<div class="plan-summary-banner plan-summary-banner--warn">
            <div>Kechiktirilgan jami</div>
            <div>${window.formatM(skipData.grandTotal)}</div>
        </div>`;
    }
    window.setHtml("planned-list-skipped", finalSkipHtml + (skipData.html || "<div class='empty-state'>Kechiktirilgan mahsulotlar yo'q.</div>"));

    const historyItems = allUserPlans.filter(x => x.archived).sort((a, b) => b.id - a.id);
    let historyGroups = {};
    historyItems.forEach(item => {
        let dateKey = item.buyDate || 'Noma\'lum sana';
        if (!historyGroups[dateKey]) historyGroups[dateKey] = { list: [], total: 0 };
        historyGroups[dateKey].list.push(item);
        historyGroups[dateKey].total += (item.buyPrice || item.price || 0);
    });

    let htmlHistory = "";
    for (let date in historyGroups) {
        let safeDateId = window.slugify(date);
        htmlHistory += `<div class="plan-history-group">
            <div onclick="toggleHistoryDate('${safeDateId}')" class="plan-history-head">
                <div>📅 ${date} <span id="hist-arrow-${safeDateId}">▶</span></div>
                <div>${window.formatM(historyGroups[date].total)}</div>
            </div>
            <div id="hist-${safeDateId}" class="hidden plan-history-body">
                ${historyGroups[date].list.map(x => `
                    <div class="plan-history-row">
                        <div>
                            <div style="font-size:13px;">${x.text}</div>
                            <div style="font-size:10px; color:var(--text-muted); margin-top:2px;">🏷️ ${x.cat.replace(/_/g, ' ')} | 📍 ${x.market}</div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:13px; font-weight:bold;">${window.formatM(x.buyPrice || x.price)}</div>
                            <button onclick="permDelPlan(${x.id})" style="background:none; border:none; color:var(--danger); font-size:14px; cursor:pointer;">🗑️</button>
                        </div>
                    </div>
                `).join("")}
            </div>
        </div>`;
    }
    window.setHtml("planned-list-history", htmlHistory || "<div class='empty-state'>Tarix bo'sh.</div>");
};
