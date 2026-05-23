// ==========================================
// UI.JS - Modallar, Navigatsiya, Drag & Drop
// ==========================================

window.openModal = id => {
    const el = window.el(id);
    if (el) { el.classList.remove('hidden'); el.style.display = 'flex'; }
};
window.closeModal = id => {
    const el = window.el(id);
    if (el) { el.style.display = 'none'; el.classList.add('hidden'); }
}; 
window.closeModalOutside = (e, id) => { if(e.target.id === id) window.closeModal(id); };

window.toggleSidebar = () => { 
    const m = window.el("sidebar-menu"), o = window.el("sidebar-overlay"); 
    if (m.classList.contains("open")) { 
        m.classList.remove("open"); 
        o.style.display="none";
        window.el("sidebar-settings-panel")?.classList.add("hidden");
        window.el("sidebar-settings-btn")?.classList.remove("active");
    } else { 
        m.classList.add("open"); 
        o.style.display="block"; 
    } 
};

window.toggleSettingsPanel = function() {
    const panel = window.el("sidebar-settings-panel");
    const btn = window.el("sidebar-settings-btn");
    if (!panel) return;
    panel.classList.toggle("hidden");
    const visible = !panel.classList.contains("hidden");
    btn?.classList.toggle("active", visible);
    if (visible && window.syncSettingsUI) window.syncSettingsUI();
};

window.selectProfile = id => {
    if (window.selectProfileSafe) window.selectProfileSafe(id);
    else {
        window.curProf = id;
        window.toggleSidebar();
        if (window.renderSidebar) window.renderSidebar();
        window.checkAccess();
        if (window.updatePlanCats) window.updatePlanCats();
        if (window.render) window.render();
    }
};

window.saveNewProfile = () => { 
    const n = window.val("prof-name").trim(), a = parseInt(window.val("prof-age")), r = window.val("prof-role"); 
    let em = window.val("prof-emoji").trim(); if(!em) em = r.endsWith('_f') ? "👧" : "👦"; 
    if(!n) return window.toast(window.t("name_required"), true);
    window.state.profiles.push({ id: "p_"+Date.now(), name: n, age: isNaN(a)?null:a, role: r, icon: em });
    window.closeModal('modal-profile'); window.setVal("prof-name",""); window.setVal("prof-age",""); window.setVal("prof-emoji","");
    window.save(); window.renderSidebar(); window.toast(window.t("added"));
};

window.checkAccess = function() {
    const p = window.state.profiles.find(x => x.id === window.curProf);
    const isChild = p && p.age != null && p.age < 16 && !window.PROTECTED_PROFILE_IDS?.includes(p.id);
    if (isChild) {
        if (window.addMode !== "expense" && window.setAddMode) window.setAddMode("expense");
    }
    if (window.applyModulePermissions) window.applyModulePermissions();
    if (window.curTab && !window.canAccessTab(window.curTab, p)) {
        window.switchTab(window.getFirstAllowedTab(p), true);
    }
};

window.switchTab = (id, silent) => {
    if (!window.canAccessTab(id)) {
        const alt = window.getFirstAllowedTab();
        if (!silent) window.toast(window.t("svc_no_access"), true);
        if (alt !== id) return window.switchTab(alt, true);
        return;
    }
    window.curTab = id;
    document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
    const nav = window.el("nav-" + id);
    if (nav) nav.classList.add("active");

    ["home", "add", "other", "report"].forEach(t => {
        const e = window.el("tab-" + t);
        if (e) { if (t === id) e.classList.remove("hidden"); else e.classList.add("hidden"); }
    });

    if (id !== "other" && window.el("back-btn") && !window.el("back-btn").classList.contains("hidden")) {
        window.closeBankSubView();
    }
    if (id === "home") {
        if (window.renderHomeTab) window.renderHomeTab();
        if (window.updatePlanCats) window.updatePlanCats();
    }
    if (id === "add") {
        window.checkAccess();
        if (window.initAddKeyboard) window.initAddKeyboard();
        if (window.focusAddAmount) window.focusAddAmount();
        if (window.syncAddLayout) window.syncAddLayout();
    }
    if (id === "report" && window.renderReport) window.renderReport();
    if (id === "other") {
        if (window.renderServicesMenu) window.renderServicesMenu();
    }
    document.body.classList.toggle("on-add-tab", id === "add");
    if (window.exitCatEditMode) window.exitCatEditMode(true);
    if (window.exitServiceEditMode) window.exitServiceEditMode(true);
    if (window.closeHeaderPanels) window.closeHeaderPanels();
    if (window.render) window.render();
};

window.initCloseActionOld = (actionFunc) => { window.confirmActionOld = actionFunc; window.setVal("confirm-code", ""); window.openModal("modal-confirm"); };
window.executeConfirmOld = () => { if(window.val("confirm-code").trim().toUpperCase() !== window.t("confirm_code").toUpperCase()) return window.toast(window.t("confirm_code_error"), true); if(window.confirmActionOld) window.confirmActionOld(); window.closeModal("modal-confirm"); window.confirmActionOld = null; };

window.openUniversalConfirm = (text, actionFunc) => { window.setTxt("yn-confirm-text", text); window.confirmActionYN = actionFunc; window.openModal("modal-yn-confirm"); };
window.executeConfirmYN = () => { if(window.confirmActionYN) window.confirmActionYN(); window.closeModal("modal-yn-confirm"); window.confirmActionYN = null; };

window.curBankSub = null;

window.SUBVIEW_PERM = {
    plan: "mod_plan",
    sched: "mod_sched",
    credit: "view_credit",
    dep: "view_dep",
    debt: "mod_debt"
};

window.closeBankSubViewIfDenied = function() {
    if (!window.curBankSub) return;
    const perm = window.SUBVIEW_PERM[window.curBankSub];
    if (perm && !window.hasPermission(perm)) window.closeBankSubView();
};

window.openBankSubView = (type) => {
    if (window.serviceEditMode) return;
    const perm = window.SUBVIEW_PERM[type];
    if (perm && !window.hasPermission(perm)) return window.toast(window.t("svc_no_access"), true);

    window.curBankSub = type;

    window.el('bank-main-menu').classList.add('hidden');
    ['plan', 'sched', 'credit', 'dep', 'debt'].forEach(s => { if(window.el('bank-sub-'+s)) window.el('bank-sub-'+s).classList.add('hidden'); });
    window.el('bank-sub-'+type).classList.remove('hidden');
    window.el('main-menu-btn-top').classList.add('hidden');
    window.el('header-main')?.classList.add('hidden');
    window.el('back-btn').classList.remove('hidden');

    let titles = {
        plan: `<span>🛒</span> <span>${window.t("sub_plan")}</span>`,
        sched: `<span>📅</span> <span>${window.t("sub_sched")}</span>`,
        credit: `<span>💳</span> <span>${window.t("sub_credit")}</span>`,
        dep: `<span>🏦</span> <span>${window.t("sub_dep")}</span>`,
        debt: `<span>🤝</span> <span>${window.t("sub_debt")}</span>`
    };
    window.setHtml('sub-view-title', titles[type]);

    if(type === 'credit' && window.switchCrTab) window.switchCrTab('aktiv');
    if(type === 'dep' && window.switchDepTab) window.switchDepTab('aktiv');
    if(type === 'plan') {
        if (window.updatePlanCats) window.updatePlanCats();
        if (window.switchPlanTab) window.switchPlanTab('add');
    }
};

window.closeBankSubView = () => {
    window.curBankSub = null;
    document.body.classList.remove('on-plan-add-tab');
    ['plan', 'sched', 'credit', 'dep', 'debt'].forEach(s => { if(window.el('bank-sub-'+s)) window.el('bank-sub-'+s).classList.add('hidden'); });
    window.el('bank-main-menu').classList.remove('hidden');
    window.el('back-btn').classList.add('hidden');
    window.el('main-menu-btn-top').classList.remove('hidden');
    window.el('header-main')?.classList.remove('hidden');
};

window.switchCrTab = (tab) => {
    ['aktiv', 'arxiv', 'calc'].forEach(t => {
        let btn = window.el('cr-tab-' + t); let view = window.el('cr-view-' + t);
        if(btn && view) { if(t === tab) { btn.style.background = 'var(--primary)'; btn.style.borderColor = 'var(--primary)'; view.classList.remove('hidden'); } else { btn.style.background = 'var(--bg-card)'; btn.style.borderColor = 'var(--border-color)'; view.classList.add('hidden'); } }
    });
    if((tab==='aktiv' || tab==='arxiv') && window.render) window.render();
};

window.switchDepTab = (tab) => {
    ['aktiv', 'arxiv', 'calc'].forEach(t => {
        let btn = window.el('dep-tab-' + t); let view = window.el('dep-view-' + t);
        if(btn && view) { if(t === tab) { btn.style.background = 'var(--primary)'; btn.style.borderColor = 'var(--primary)'; view.classList.remove('hidden'); } else { btn.style.background = 'var(--bg-card)'; btn.style.borderColor = 'var(--border-color)'; view.classList.add('hidden'); } }
    });
    if((tab==='aktiv' || tab==='arxiv') && window.render) window.render();
};

window.SERVICE_ITEMS = [
    { id: "plan", icon: "🛒", labelKey: "svc_plan" },
    { id: "sched", icon: "📅", labelKey: "svc_sched" },
    { id: "credit", icon: "💳", labelKey: "svc_credit" },
    { id: "dep", icon: "🏦", labelKey: "svc_dep" },
    { id: "debt", icon: "🤝", labelKey: "svc_debt" }
];

window.refreshBankSubViewTitle = function() {
    if (!window.curBankSub) return;
    const map = {
        plan: `<span>🛒</span> <span>${window.t("sub_plan")}</span>`,
        sched: `<span>📅</span> <span>${window.t("sub_sched")}</span>`,
        credit: `<span>💳</span> <span>${window.t("sub_credit")}</span>`,
        dep: `<span>🏦</span> <span>${window.t("sub_dep")}</span>`,
        debt: `<span>🤝</span> <span>${window.t("sub_debt")}</span>`
    };
    window.setHtml("sub-view-title", map[window.curBankSub] || "");
};

window.migrateServiceMenuOrder = function() {
    try {
        const old = JSON.parse(localStorage.getItem("menu_order_v1") || "null");
        const key = window.getCatOrderKey("services", null);
        if (old?.length && !window.state.catOrders?.[key]) {
            if (!window.state.catOrders) window.state.catOrders = {};
            window.state.catOrders[key] = old;
            window.save(true);
        }
    } catch (e) {}
};

window.enterServiceEditMode = function() {
    window.serviceEditMode = true;
    window.renderServicesMenu();
    window.toast(window.t("sort_mode"));
};

window.exitServiceEditMode = function(silent) {
    if (!window.serviceEditMode) return;
    window.serviceEditMode = false;
    window.renderServicesMenu();
    if (!silent) window.toast(window.t("ready"));
};

window.renderServicesMenu = function() {
    const menu = window.el("bank-main-menu");
    const head = window.el("services-menu-head");
    if (!menu) return;
    window.migrateServiceMenuOrder();

    const p = window.getActiveProfile ? window.getActiveProfile() : null;
    let items = window.SERVICE_ITEMS.filter(it => {
        const perm = window.SUBVIEW_PERM?.[it.id];
        return !perm || window.hasPermission(perm, p);
    });
    items = window.applyCatOrder(items, "services", null);
    const isHidden = id => window.isCatHidden(id, "services", null);
    if (window.serviceEditMode) {
        items = [...items.filter(i => !isHidden(i.id)), ...items.filter(i => isHidden(i.id))];
    } else {
        items = items.filter(i => !isHidden(i.id));
    }

    if (head) {
        head.innerHTML = window.serviceEditMode
            ? `<div class="add-crumb add-crumb--edit"><span>↕️ ${window.t("sort_mode")}</span><button type="button" class="back-link add-cats-done" onclick="window.exitServiceEditMode()">${window.t("ready")}</button></div>`
            : `<div class="add-cats-hint">${window.t("sort_hint")}</div>`;
    }

    menu.classList.toggle("services-menu--edit", window.serviceEditMode);
    menu.innerHTML = items.map(item => {
        const hidden = isHidden(item.id);
        const wiggle = window.serviceEditMode && !hidden ? " main-menu-btn--wiggle" : "";
        const masked = hidden ? " main-menu-btn--masked" : "";
        const hideBtn = window.serviceEditMode
            ? `<span class="cat-btn__hide${hidden ? " cat-btn__hide--restore" : ""}" onclick="window.onHideCatClick(event,'${item.id}','services','root')">${hidden ? "↩" : "×"}</span>`
            : "";
        const click = window.serviceEditMode
            ? (hidden ? ` onclick="window.onRestoreCatClick(event,'${item.id}','services','root')"` : "")
            : ` onclick="openBankSubView('${item.id}')"`;
        return `<div class="main-menu-btn${wiggle}${masked}" data-id="${item.id}" data-cat-id="${item.id}"${click}>${hideBtn}<span class="icon">${item.icon}</span><span class="text">${window.t(item.labelKey)}</span>${window.serviceEditMode ? "" : `<span class="drag-handle">≡</span>`}</div>`;
    }).join("");
};

window.setupServicesMenuDrag = function() {
    const wrap = window.el("services-menu-wrap");
    const menu = window.el("bank-main-menu");
    if (!wrap || !menu) return;
    if (wrap.dataset.svcDrag === "4") return;
    wrap.dataset.svcDrag = "4";
    let dragEl = null, pressTimer = null, pressTarget = null;
    let startX = 0, startY = 0, scrollMode = false, lastScrollY = 0;
    const LONG_MS = 500, MOVE_PX = 14;
    const scrollEl = wrap;

    const clearPress = () => {
        clearTimeout(pressTimer);
        pressTimer = null;
        pressTarget = null;
    };

    const resetScroll = () => {
        scrollMode = false;
        lastScrollY = 0;
    };

    const movedTooFar = (x, y) => Math.hypot(x - startX, y - startY) > MOVE_PX;

    const endDrag = () => {
        clearPress();
        resetScroll();
        if (!dragEl) return;
        dragEl.classList.remove("dragging");
        const ids = Array.from(menu.querySelectorAll(".main-menu-btn[data-cat-id]")).map(b => b.getAttribute("data-cat-id"));
        window.saveCatOrder("services", null, ids);
        dragEl = null;
    };

    const beginLongPress = () => {
        pressTimer = null;
        if (!pressTarget) return;
        window._blockSvcTap = true;
        if (!window.serviceEditMode) window.enterServiceEditMode();
        if (navigator.vibrate) navigator.vibrate(50);
    };

    const beginDragHold = () => {
        pressTimer = null;
        if (!pressTarget || !window.serviceEditMode) return;
        const id = pressTarget.getAttribute("data-cat-id");
        dragEl = menu.querySelector(`.main-menu-btn[data-cat-id="${id}"]`) || pressTarget;
        dragEl?.classList.add("dragging");
        if (navigator.vibrate) navigator.vibrate(30);
    };

    const onPressStart = (x, y, target) => {
        if (!target) return;
        resetScroll();
        pressTarget = target;
        startX = x;
        startY = y;
        lastScrollY = y;
        clearTimeout(pressTimer);
        pressTimer = setTimeout(window.serviceEditMode ? beginDragHold : beginLongPress, LONG_MS);
    };

    const handleMove = (x, y, prevent) => {
        if (scrollMode) {
            scrollEl.scrollTop -= (y - lastScrollY);
            lastScrollY = y;
            return true;
        }
        if (pressTimer && !dragEl) {
            const dx = Math.abs(x - startX), dy = Math.abs(y - startY);
            if (window.serviceEditMode && dy > MOVE_PX && dy > dx * 1.1) {
                clearPress();
                scrollMode = true;
                lastScrollY = y;
                return true;
            }
            if (!window.serviceEditMode && movedTooFar(x, y)) {
                clearPress();
                return false;
            }
        }
        if (!dragEl) return false;
        prevent();
        const elemBelow = document.elementFromPoint(x, y);
        const dropTarget = elemBelow ? elemBelow.closest(".main-menu-btn[data-cat-id]") : null;
        if (dropTarget && dropTarget !== dragEl) {
            const rect = dropTarget.getBoundingClientRect();
            const next = (y - rect.top) / (rect.bottom - rect.top) > 0.5;
            menu.insertBefore(dragEl, next ? dropTarget.nextSibling : dropTarget);
        }
        return true;
    };

    wrap.addEventListener("touchstart", e => {
        if (e.target.closest(".cat-btn__hide") || e.target.closest(".add-cats-done")) return;
        const target = e.target.closest(".main-menu-btn[data-cat-id]");
        if (!target) return;
        const t = e.touches[0];
        onPressStart(t.clientX, t.clientY, target);
    }, { passive: true });

    wrap.addEventListener("pointerdown", e => {
        if (e.pointerType !== "mouse" || e.button !== 0) return;
        if (e.target.closest(".cat-btn__hide") || e.target.closest(".add-cats-done")) return;
        const target = e.target.closest(".main-menu-btn[data-cat-id]");
        if (!target) return;
        onPressStart(e.clientX, e.clientY, target);
    });

    wrap.addEventListener("touchmove", e => {
        const touch = e.touches[0];
        if (handleMove(touch.clientX, touch.clientY, () => e.preventDefault())) {
            if (scrollMode || dragEl) e.preventDefault();
        }
    }, { passive: false });

    wrap.addEventListener("pointermove", e => {
        if (e.pointerType !== "mouse") return;
        handleMove(e.clientX, e.clientY, () => e.preventDefault());
    });

    const onPressEnd = () => {
        setTimeout(() => { window._blockSvcTap = false; }, 200);
        endDrag();
    };

    wrap.addEventListener("touchend", onPressEnd);
    wrap.addEventListener("touchcancel", onPressEnd);
    wrap.addEventListener("pointerup", e => {
        if (e.pointerType !== "mouse") return;
        onPressEnd();
    });
    wrap.addEventListener("pointercancel", e => {
        if (e.pointerType !== "mouse") return;
        onPressEnd();
    });

    wrap.addEventListener("click", e => {
        if (e.target.closest(".cat-btn__hide") || e.target.closest(".add-cats-done")) return;
        if (e.target.closest(".main-menu-btn--masked")) return;
        if (window._blockSvcTap) {
            e.preventDefault();
            e.stopPropagation();
        }
    }, true);

    document.addEventListener("touchstart", e => {
        if (!window.serviceEditMode) return;
        if (e.target.closest("#services-menu-wrap") || e.target.closest(".add-cats-done")) return;
        if (e.target.closest("#tab-other")) window.exitServiceEditMode(true);
    }, { passive: true });
};

window.initDragAndDrop = function() {
    window.renderServicesMenu();
    window.setupServicesMenuDrag();
};
