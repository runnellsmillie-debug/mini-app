// ==========================================
// SHOPPING.JS - Bozorlik ro'yxati mantiqi
// ==========================================

window.tMarketName = function(m) {
    const map = {
        ru: { Bozor: "Рынок", Korzinka: "Korzinka", Makro: "Makro", Uzum: "Uzum", "Do'kon": "Магазин" },
        en: { Bozor: "Market", Korzinka: "Korzinka", Makro: "Makro", Uzum: "Uzum", "Do'kon": "Shop" }
    };
    const lang = window.getLang ? window.getLang() : "uz";
    if (lang === "uz") return m;
    return map[lang]?.[m] || m;
};

window.syncPlanUi = function() {
    const phMap = { "plan-name": "plan_product_ph", "plan-qty": "plan_qty_ph" };
    Object.entries(phMap).forEach(([id, key]) => {
        const el = window.el(id);
        if (el) el.placeholder = window.t(key);
    });
    const priceLbl = document.querySelector(".plan-price-label");
    if (priceLbl) priceLbl.textContent = window.t("plan_est_price");
    const saveBtn = document.querySelector("#plan-view-add .btn-success span[data-i18n='plan_save_btn']");
    if (saveBtn) saveBtn.textContent = window.t("plan_save_btn");
    if (window.updatePlanFilters) window.updatePlanFilters();
    if (window.updatePlanCats) window.updatePlanCats();
};

window.updatePlanFilters = function() {
    const fm = window.el("filter-market");
    const fc = window.el("filter-cat");
    const fmVal = fm ? fm.value : "all";
    const fcVal = fc ? fc.value : "all";
    if (fm) {
        fm.innerHTML = `<option value="all">${window.t("filter_market")}: ${window.t("filter_all")}</option>`
            + ["Bozor", "Korzinka", "Makro", "Uzum", "Do'kon"].map(m => `<option value="${m}">${window.tMarketName(m)}</option>`).join("");
        if ([...fm.options].some(o => o.value === fmVal)) fm.value = fmVal;
    }
    if (fc) {
        const cats = ["Oziq-ovqat", "Uy_Xojalik", "Kiyim"];
        fc.innerHTML = `<option value="all">${window.t("filter_cat")}: ${window.t("filter_all")}</option>`
            + cats.map(c => `<option value="${c}">${window.tCatName(c)}</option>`).join("");
        if ([...fc.options].some(o => o.value === fcVal)) fc.value = fcVal;
    }
};

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
        const label = window.tCatName(c);
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
    cEl.innerHTML = c.map(x => `<option value="${x}">${window.tCatName(x)}</option>`).join("");
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
            subEl.innerHTML += `<option value="${s}">${window.tSubcatName(s)}</option>`;
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
            const lbl = window.tItemName(t);
            cont.innerHTML += `<div class="smart-tag" onclick="window.quickAddPlan('${t.replace(/'/g, "\\'")}')">${lbl}</div>`;
        });
    } else cont.innerHTML = `<span style='color:var(--text-muted); font-size:12px;'>${window.t("quick_tags_none")}</span>`;
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
        ni.value = window.tItemName(t);
        ni.style.borderColor = "var(--success)";
        setTimeout(() => { ni.style.borderColor = "var(--border-color)"; }, 600);
    }
    if (qi) qi.value = "";
    window.planPriceStr = autoPrice > 0 ? String(autoPrice) : "";
    window.syncPlanPriceDisplay();
    window.focusPlanPrice();
    window.toast(autoPrice > 0 ? window.t("plan_price_history") : window.t("plan_enter_price"));
};

window.addPlannedItemManual = () => {
    const n = window.val("plan-name").trim();
    const q = window.val("plan-qty").trim();
    const c = window.val("smart-plan-cat");
    const m = window.val("plan-market");
    let p = parseInt(window.planPriceStr || "0", 10) || window.getNum("plan-price");

    if (!n) return window.toast(window.t("name_required"), true);
    if (!p || p === 0) p = window.getHistoricalPrice(n);
    if (!p) return window.toast(window.t("plan_enter_price"), true);

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
    window.toast(window.t("plan_added"));
};

window.skipPlanItem = id => {
    const i = window.state.plan.find(x => x.id == id);
    if (i) { i.skip = true; window.save(); window.renderPlanned(); window.toast(window.t("plan_postponed")); }
};

window.unskipPlanItem = id => {
    const i = window.state.plan.find(x => x.id == id);
    if (i) { i.skip = false; window.save(); window.renderPlanned(); window.toast(window.t("plan_restored")); }
};

window.permDelPlan = id => {
    window.openUniversalConfirm(window.t("plan_del_confirm"), () => {
        window.state.plan = window.state.plan.filter(x => x.id != id);
        window.save();
        window.renderPlanned();
        window.toast(window.t("deleted_excl"));
    });
};

window.openBuyModal = id => {
    const i = window.state.plan.find(x => x.id == id);
    if (!i) return;
    window.buyPlanId = id;
    window.setTxt("buy-item-name", `✅ ${window.t("plan_buying_prefix")} ${i.text}`);
    window.el("buy-price").value = i.price ? new Intl.NumberFormat('ru-RU').format(i.price).replace(/,/g, ' ') : "";
    window.openModal("modal-buy");
};

window.confirmBuyItem = () => {
    const p = window.getNum("buy-price");
    if (!p || p <= 0) return window.toast(window.t("plan_price_error"), true);
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
    window.toast(window.t("plan_bought"));
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
                    <span>${window.CAT_ICONS[cat] || '📦'} ${window.tCatName(cat)}</span>
                    <span>${window.formatM(groups[cat].total)}</span>
                </div>
                ${groups[cat].list.map(x => `
                    <div class="plan-item plan-item--flat">
                        <div style="flex:1;">
                            <div style="font-weight:600; font-size:14px;">${x.text}</div>
                            <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">📍 ${window.tMarketName(x.market)} | 💰 ${window.formatM(x.price || 0)}</div>
                        </div>
                        <div style="display:flex; gap:5px; flex-direction:column;">
                            ${isSkippedMode ?
                                `<button onclick="unskipPlanItem(${x.id})" class="btn-primary" style="width:auto; padding:5px 15px; font-size:11px; margin:0; background:transparent; border:1px dashed var(--success); color:var(--success);">⤴️ ${window.t("plan_return")}</button>`
                                :
                                `<button onclick="openBuyModal(${x.id})" class="btn-primary btn-success" style="width:auto; padding:5px 15px; font-size:12px; margin:0;">${window.t("plan_buy")}</button>
                                 <button onclick="skipPlanItem(${x.id})" class="btn-primary" style="width:auto; padding:4px 15px; font-size:11px; margin:0; background:var(--bg-card); border:1px solid var(--warning); color:var(--warning);">⏳ ${window.t("plan_later")}</button>`
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
            <div>${window.t("plan_total_expected")}</div>
            <div>${window.formatM(activeData.grandTotal)}</div>
        </div>`;
    }
    window.setHtml("planned-list-active", finalActiveHtml + (activeData.html || `<div class='empty-state'>${window.t("plan_empty")}</div>`));

    const skipData = renderGroupedList(allUserPlans.filter(x => !x.archived && x.skip), true);
    let finalSkipHtml = "";
    if (skipData.grandTotal > 0) {
        finalSkipHtml += `<div class="plan-summary-banner plan-summary-banner--warn">
            <div>${window.t("plan_total_skipped")}</div>
            <div>${window.formatM(skipData.grandTotal)}</div>
        </div>`;
    }
    window.setHtml("planned-list-skipped", finalSkipHtml + (skipData.html || `<div class='empty-state'>${window.t("plan_skip_empty")}</div>`));

    const historyItems = allUserPlans.filter(x => x.archived).sort((a, b) => b.id - a.id);
    let historyGroups = {};
    historyItems.forEach(item => {
        let dateKey = item.buyDate || window.t("plan_unknown_date");
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
                            <div style="font-size:10px; color:var(--text-muted); margin-top:2px;">🏷️ ${window.tCatName(x.cat)} | 📍 ${window.tMarketName(x.market)}</div>
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
    window.setHtml("planned-list-history", htmlHistory || `<div class='empty-state'>${window.t("plan_history_empty")}</div>`);
};
