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
    if (m.classList.contains("open")) { m.classList.remove("open"); o.style.display="none"; } 
    else { m.classList.add("open"); o.style.display="block"; } 
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
    if(!n) return window.toast("Ism!", true); 
    window.state.profiles.push({ id: "p_"+Date.now(), name: n, age: isNaN(a)?null:a, role: r, icon: em }); 
    window.closeModal('modal-profile'); window.setVal("prof-name",""); window.setVal("prof-age",""); window.setVal("prof-emoji",""); 
    window.save(); window.renderSidebar(); window.toast("Qo'shildi!"); 
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
        if (!silent) window.toast("Bu bo'limga ruxsat yo'q", true);
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
    if (id === "add") {
        window.checkAccess();
        if (window.initAddKeyboard) window.initAddKeyboard();
        if (window.focusAddAmount) window.focusAddAmount();
        if (window.syncAddLayout) window.syncAddLayout();
    }
    if (id === "home" && window.updatePlanCats) window.updatePlanCats();
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
window.executeConfirmOld = () => { if(window.val("confirm-code").trim() !== "YOPISH") return window.toast("Xato: YOPISH deb yozing!", true); if(window.confirmActionOld) window.confirmActionOld(); window.closeModal("modal-confirm"); window.confirmActionOld = null; };

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
    if (perm && !window.hasPermission(perm)) return window.toast("Bu bo'limga ruxsat yo'q", true);

    window.curBankSub = type;

    window.el('bank-main-menu').classList.add('hidden');
    ['plan', 'sched', 'credit', 'dep', 'debt'].forEach(s => { if(window.el('bank-sub-'+s)) window.el('bank-sub-'+s).classList.add('hidden'); });
    window.el('bank-sub-'+type).classList.remove('hidden');
    window.el('main-menu-btn-top').classList.add('hidden');
    window.el('header-main')?.classList.add('hidden');
    window.el('back-btn').classList.remove('hidden');

    let titles = { 
        'plan': '<span>🛒</span> <span>Bozorlik</span>',
        'sched': '<span>📅</span> <span>Rejali to\'lovlar</span>',
        'credit': '<span>💳</span> <span>Kreditlar</span>', 
        'dep': '<span>🏦</span> <span>Omonatlar</span>', 
        'debt': '<span>🤝</span> <span>Qarzlar</span>' 
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
    { id: "plan", icon: "🛒", label: "Bozorlik ro'yxati" },
    { id: "sched", icon: "📅", label: "Rejali to'lovlar" },
    { id: "credit", icon: "💳", label: "Kreditlar bo'limi" },
    { id: "dep", icon: "🏦", label: "Omonatlar bo'limi" },
    { id: "debt", icon: "🤝", label: "Qarzlar bo'limi" }
];

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
    window.toast("Tartiblash rejimi");
};

window.exitServiceEditMode = function(silent) {
    if (!window.serviceEditMode) return;
    window.serviceEditMode = false;
    window.renderServicesMenu();
    if (!silent) window.toast("Tayyor");
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
            ? `<div class="add-crumb add-crumb--edit"><span>↕️ Tartiblash rejimi</span><button type="button" class="back-link add-cats-done" onclick="window.exitServiceEditMode()">Tayyor</button></div>`
            : `<div class="add-cats-hint">Ushlab turing — tartiblash rejimi</div>`;
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
        return `<div class="main-menu-btn${wiggle}${masked}" data-id="${item.id}" data-cat-id="${item.id}"${click}>${hideBtn}<span class="icon">${item.icon}</span><span class="text">${item.label}</span>${window.serviceEditMode ? "" : `<span class="drag-handle">≡</span>`}</div>`;
    }).join("");
};

window.setupServicesMenuDrag = function() {
    const wrap = window.el("services-menu-wrap");
    const menu = window.el("bank-main-menu");
    if (!wrap || !menu) return;
    if (wrap.dataset.svcDrag === "2") return;
    wrap.dataset.svcDrag = "2";
    let dragEl = null, pressTimer = null;

    const clearPress = () => { clearTimeout(pressTimer); pressTimer = null; };
    const endDrag = () => {
        clearPress();
        if (!dragEl) return;
        dragEl.classList.remove("dragging");
        const ids = Array.from(menu.querySelectorAll(".main-menu-btn[data-cat-id]")).map(b => b.getAttribute("data-cat-id"));
        window.saveCatOrder("services", null, ids);
        dragEl = null;
    };

    wrap.addEventListener("touchstart", e => {
        if (e.target.closest(".cat-btn__hide") || e.target.closest(".add-cats-done")) return;

        if (!window.serviceEditMode) {
            const target = e.target.closest(".main-menu-btn[data-cat-id]");
            if (!target) return;
            clearPress();
            pressTimer = setTimeout(() => {
                window.enterServiceEditMode();
                dragEl = target;
                dragEl.classList.add("dragging");
                if (navigator.vibrate) navigator.vibrate(50);
            }, 500);
            return;
        }

        const target = e.target.closest(".main-menu-btn[data-cat-id]");
        if (!target) return;
        clearPress();
        dragEl = target;
        dragEl.classList.add("dragging");
        if (navigator.vibrate) navigator.vibrate(30);
    }, { passive: true });

    wrap.addEventListener("touchmove", e => {
        if (!window.serviceEditMode || !dragEl) { clearPress(); return; }
        e.preventDefault();
        const touch = e.touches[0];
        const elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);
        const dropTarget = elemBelow ? elemBelow.closest(".main-menu-btn[data-cat-id]") : null;
        if (dropTarget && dropTarget !== dragEl) {
            const rect = dropTarget.getBoundingClientRect();
            const next = (touch.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;
            menu.insertBefore(dragEl, next ? dropTarget.nextSibling : dropTarget);
        }
    }, { passive: false });

    wrap.addEventListener("touchend", endDrag);
    wrap.addEventListener("touchcancel", endDrag);

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
