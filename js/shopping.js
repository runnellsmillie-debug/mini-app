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

window.planActMainCat = null;
window.planActSubCat = null;
window.planKeypadMode = "amount";

window.syncPlanUi = function() {
    const phMap = { "plan-name": "plan_product_ph", "plan-qty": "plan_qty_ph" };
    Object.entries(phMap).forEach(([id, key]) => {
        const el = window.el(id);
        if (el) el.placeholder = window.t(key);
    });
    const priceLbl = document.querySelector("#plan-view-add .plan-price-label");
    if (priceLbl) priceLbl.textContent = window.t("plan_est_price");
    if (window.updatePlanFilters) window.updatePlanFilters();
    if (window.updatePlanCats) window.updatePlanCats();
    if (window.renderPlanMarketChips) window.renderPlanMarketChips();
};

window.syncPlanLayout = function() {
    requestAnimationFrame(() => {
        const stack = window.el("plan-bottom-stack");
        if (!stack) return;
        const h = Math.ceil(stack.getBoundingClientRect().height);
        if (h > 0) document.documentElement.style.setProperty("--plan-bottom-stack-h", h + "px");
    });
};

window.focusPlanAmount = function() {
    window.planKeypadMode = "amount";
    const nd = window.el("plan-num-display");
    document.querySelectorAll(".plan-meta-input").forEach(el => el.classList.remove("plan-input--active"));
    if (nd) nd.classList.add("num-display--active");
    window.syncPlanLayout();
};

window.focusPlanName = function() {
    window.planKeypadMode = "name";
    const nd = window.el("plan-num-display");
    if (nd) nd.classList.remove("num-display--active");
    window.syncPlanLayout();
};

window.getAllowedPlanCats = function() {
    const p = window.state.profiles.find(x => x.id === window.curProf);
    let c = Object.keys(window.PLAN_TAGS || {});
    if (p?.id === "home_profile") c = ["Oziq-ovqat", "Uy_Xojalik"];
    else if (p && p.age != null && p.age <= 6) c = ["Oyinchoq", "Bolalar", "Talim", "Kiyim", "Oziq-ovqat"].filter(x => c.includes(x) || c.some(k => k.includes(x.split("_")[0])));
    else if (p && p.age != null && p.age < 16) c = ["Kiyim", "Talim", "Oyinchoq", "Oziq-ovqat"].filter(x => c.includes(x));
    if (p && p.permissions && p.permissions.length && !p.permissions.includes("admin_all")) {
        const allow = [];
        if (p.permissions.includes("shop_food")) allow.push("Oziq-ovqat", "Uy_Xojalik");
        if (p.permissions.includes("shop_clothes")) allow.push("Kiyim");
        if (p.permissions.includes("shop_school")) allow.push("Talim");
        if (allow.length) c = c.filter(x => allow.some(a => x.includes(a) || a.includes(x)));
    }
    if (!c.length) c = Object.keys(window.PLAN_TAGS || {});
    return c;
};

window.planItemIcon = function(raw) {
    const m = String(raw).match(/^[\p{Extended_Pictographic}\p{Emoji_Presentation}]/u);
    return m ? m[0] : "🏷️";
};

window.renderPlanMarketChips = function() {
    const wrap = window.el("plan-market-chips");
    if (!wrap) return;
    const markets = ["Bozor", "Korzinka", "Makro", "Uzum", "Do'kon"];
    let cur = window.val("plan-market") || "Bozor";
    if (!markets.includes(cur)) cur = "Bozor";
    window.setVal("plan-market", cur);
    wrap.innerHTML = markets.map(m => {
        const active = m === cur ? " plan-market-chip--active" : "";
        return `<button type="button" class="plan-market-chip${active}" onclick="window.selectPlanMarket('${m.replace(/'/g, "\\'")}')">${window.tMarketName(m)}</button>`;
    }).join("");
};

window.selectPlanMarket = function(m) {
    window.setVal("plan-market", m);
    window.renderPlanMarketChips();
};

window.syncPlanSubcatSelect = function() {
    const cat = window.planActMainCat;
    const subEl = window.el("smart-plan-subcat");
    if (!subEl) return;
    subEl.innerHTML = "";
    if (cat && window.PLAN_TAGS[cat]) {
        Object.keys(window.PLAN_TAGS[cat]).forEach(s => {
            subEl.innerHTML += `<option value="${s}">${s}</option>`;
        });
    }
};

window.renderPlanAddCats = function() {
    const cont = window.el("plan-cats-container");
    const head = window.el("plan-cats-header-container");
    if (!cont || !head) return;

    const cats = window.getAllowedPlanCats();
    const mkBtn = (icon, label, onclick, extraCls = "") =>
        `<button type="button" class="cat-btn cat-btn--plan${extraCls ? " " + extraCls : ""}" onclick="${onclick}"><span class="cat-btn__icon">${icon}</span><span class="cat-btn__label">${label}</span></button>`;
    const wrap = (html, level) => `<div class="cat-scroll--plan cat-grid--${level}">${html}</div>`;

    if (window.planActSubCat && window.planActMainCat) {
        const items = (window.PLAN_TAGS[window.planActMainCat] && window.PLAN_TAGS[window.planActMainCat][window.planActSubCat]) || [];
        head.innerHTML = `<div class="add-crumb"><span>${window.tCatName(window.planActMainCat)} <b>›</b> ${window.tSubcatName(window.planActSubCat)}</span><button type="button" class="back-link" onclick="window.backPlanCat()">${window.t("back")}</button></div>`;
        cont.className = "cats-level--items";
        cont.innerHTML = wrap(items.map(t => {
            const esc = t.replace(/'/g, "\\'");
            return mkBtn(window.planItemIcon(t), window.tItemName(t), `window.clickPlanProduct('${esc}')`, "cat-btn--pick");
        }).join("") || `<div class="plan-cats-hint">${window.t("quick_tags_none")}</div>`, "items");
    } else if (window.planActMainCat) {
        const subs = window.PLAN_TAGS[window.planActMainCat] ? Object.keys(window.PLAN_TAGS[window.planActMainCat]) : [];
        head.innerHTML = `<div class="add-crumb"><span>${window.t("rukun")} <b>${window.tCatName(window.planActMainCat)}</b></span><button type="button" class="back-link" onclick="window.backPlanCat()">${window.t("back")}</button></div>`;
        cont.className = "cats-level--rukun";
        cont.innerHTML = wrap(subs.map(s => {
            const esc = s.replace(/'/g, "\\'");
            return mkBtn(window.SUBCAT_ICONS?.[s] || "📦", window.tSubcatName(s), `window.clickPlanSubCat('${esc}')`);
        }).join(""), "rukun");
    } else {
        head.innerHTML = `<div class="plan-cats-hint">${window.t("sort_hint")}</div>`;
        cont.className = "cats-level--main";
        cont.innerHTML = wrap(cats.map(c => {
            const esc = c.replace(/'/g, "\\'");
            return mkBtn(window.CAT_ICONS[c] || "📦", window.tCatName(c), `window.clickPlanMainCat('${esc}')`, "cat-btn--main");
        }).join(""), "main");
    }
};

window.clickPlanMainCat = function(cat) {
    window.planActMainCat = cat;
    window.planActSubCat = null;
    window.setVal("smart-plan-cat", cat);
    window.syncPlanSubcatSelect();
    window.renderPlanAddCats();
};

window.clickPlanSubCat = function(sub) {
    window.planActSubCat = sub;
    window.setVal("smart-plan-subcat", sub);
    window.renderPlanAddCats();
};

window.backPlanCat = function() {
    if (window.planActSubCat) window.planActSubCat = null;
    else window.planActMainCat = null;
    window.renderPlanAddCats();
};

window.clickPlanProduct = function(rawName) {
    window.quickAddPlan(rawName);
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
    const onAdd = tab === 'add' && window.curBankSub === 'plan';
    document.body.classList.toggle('on-plan-add-tab', onAdd);
    if (tab === 'add') {
        window.renderPlanMarketChips();
        window.renderPlanAddCats();
        window.syncPlanLayout();
        window.focusPlanAmount();
    } else {
        window.renderPlanned();
    }
};

window.selectPlanCat = (cat) => {
    window.clickPlanMainCat(cat);
};

window.updatePlanCats = () => {
    const cEl = window.el("smart-plan-cat");
    if (!cEl) return;
    const c = window.getAllowedPlanCats();
    const prev = window.val("smart-plan-cat");
    cEl.innerHTML = c.map(x => `<option value="${x}">${window.tCatName(x)}</option>`).join("");
    if (window.planActMainCat && c.includes(window.planActMainCat)) {
        window.setVal("smart-plan-cat", window.planActMainCat);
    } else if (prev && c.includes(prev)) {
        window.planActMainCat = prev;
        window.planActSubCat = null;
        window.setVal("smart-plan-cat", prev);
    } else {
        window.planActMainCat = null;
        window.planActSubCat = null;
        if (c.length) window.setVal("smart-plan-cat", c[0]);
    }
    window.syncPlanSubcatSelect();
    if (window.planActSubCat) window.setVal("smart-plan-subcat", window.planActSubCat);
    window.renderPlanAddCats();
    window.renderPlanMarketChips();
};

window.updateSmartTags = () => { window.syncPlanSubcatSelect(); };

window.renderSmartTags = () => {};
window.renderPlanCatChips = () => {};

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
    window.focusPlanAmount();
    if (v === "C") window.planPriceStr = "";
    else if (v === "⌫") window.planPriceStr = window.planPriceStr.slice(0, -1);
    else if (window.planPriceStr.length < 12) window.planPriceStr += v;
    window.syncPlanPriceDisplay();
};

window.focusPlanPrice = () => window.focusPlanAmount();

window.quickAddPlan = t => {
    const ni = window.el("plan-name");
    const qi = window.el("plan-qty");
    let autoPrice = window.getHistoricalPrice(t);
    if (ni) {
        ni.value = window.tItemName(t);
        ni.classList.add("plan-input--active");
        setTimeout(() => ni.classList.remove("plan-input--active"), 600);
    }
    if (qi) qi.value = "";
    window.planPriceStr = autoPrice > 0 ? String(autoPrice) : "";
    window.syncPlanPriceDisplay();
    window.focusPlanAmount();
    window.toast(autoPrice > 0 ? window.t("plan_price_history") : window.t("plan_enter_price"));
};

window.addPlannedItemManual = () => {
    const n = window.val("plan-name").trim();
    const q = window.val("plan-qty").trim();
    const c = window.planActMainCat || window.val("smart-plan-cat");
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
    window.setHtml("plan-stay-hint", `✅ ${window.t("last_entry_hint").replace("{amount}", `<b style="color:var(--success);">${window.formatM(p)}</b>`)}`);
    window.save();
    window.toast(window.t("plan_added"));
    window.focusPlanAmount();
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
                        <div class="plan-item__body">
                            <div class="plan-item__title">${x.text}</div>
                            <div class="plan-item__meta">📍 ${window.tMarketName(x.market)} · ${window.formatM(x.price || 0)}</div>
                        </div>
                        <div class="plan-item-actions">
                            ${isSkippedMode ?
                                `<button onclick="unskipPlanItem(${x.id})" class="btn-primary btn-primary--return">⤴️ ${window.t("plan_return")}</button>`
                                :
                                `<button onclick="openBuyModal(${x.id})" class="btn-primary btn-success">${window.t("plan_buy")}</button>
                                 <button onclick="skipPlanItem(${x.id})" class="btn-primary btn-primary--ghost">⏳ ${window.t("plan_later")}</button>`
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
