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
    if (id === "add") window.checkAccess();
    if (id === "home" && window.updatePlanCats) window.updatePlanCats();
    if (id === "report" && window.renderReport) window.renderReport();
    if (id === "add") {
        window.ctxSectionLabel = "Kiritish";
        window.ctxDetailLabel = window.addMode === "income" ? "Kirim" : "Chiqim";
    } else if (id !== "other" || !window.curBankSub) {
        window.ctxSectionLabel = "";
        window.ctxDetailLabel = "";
    }
    if (window.renderAddProfileStrip) window.renderAddProfileStrip();
    if (window.updateSubViewContext) window.updateSubViewContext();
    if (window.render) window.render();
};

window.initCloseActionOld = (actionFunc) => { window.confirmActionOld = actionFunc; window.setVal("confirm-code", ""); window.openModal("modal-confirm"); };
window.executeConfirmOld = () => { if(window.val("confirm-code").trim() !== "YOPISH") return window.toast("Xato: YOPISH deb yozing!", true); if(window.confirmActionOld) window.confirmActionOld(); window.closeModal("modal-confirm"); window.confirmActionOld = null; };

window.openUniversalConfirm = (text, actionFunc) => { window.setTxt("yn-confirm-text", text); window.confirmActionYN = actionFunc; window.openModal("modal-yn-confirm"); };
window.executeConfirmYN = () => { if(window.confirmActionYN) window.confirmActionYN(); window.closeModal("modal-yn-confirm"); window.confirmActionYN = null; };

window.curBankSub = null;
window.ctxSectionLabel = "";

window.SUBVIEW_PERM = {
    plan: "mod_plan",
    sched: "mod_sched",
    credit: "view_credit",
    dep: "view_dep",
    debt: "mod_debt"
};

window.SUBVIEW_LABELS = {
    plan: "Bozorlik",
    sched: "Rejali to'lovlar",
    credit: "Kreditlar",
    dep: "Omonatlar",
    debt: "Qarzlar"
};

window.updateSubViewContext = function(detail) {
    const bar = window.el("subview-context-bar");
    if (!bar) return;
    const p = window.getActiveProfile ? window.getActiveProfile() : null;
    const profIcon = window.el("ctx-prof-icon");
    const profName = window.el("ctx-prof-name");
    if (profIcon) profIcon.textContent = p?.icon || "👤";
    if (profName) profName.textContent = p?.name || "Profil";
    const sectionEl = window.el("ctx-section");
    if (sectionEl) sectionEl.textContent = window.ctxSectionLabel || "";
    const detailEl = window.el("ctx-detail");
    const sep = window.el("ctx-cat-sep");
    const showDetail = !!(detail || window.ctxDetailLabel);
    const label = detail || window.ctxDetailLabel || "";
    if (detailEl && sep) {
        if (showDetail && label) {
            detailEl.textContent = label;
            detailEl.classList.remove("hidden");
            sep.classList.remove("hidden");
        } else {
            detailEl.classList.add("hidden");
            sep.classList.add("hidden");
        }
    }
    const showBar = !!window.curBankSub || (window.curTab === "add" && window.ctxSectionLabel);
    bar.classList.toggle("hidden", !showBar);
    document.body.classList.toggle("has-ctx-bar", showBar);
};

window.closeBankSubViewIfDenied = function() {
    if (!window.curBankSub) return;
    const perm = window.SUBVIEW_PERM[window.curBankSub];
    if (perm && !window.hasPermission(perm)) window.closeBankSubView();
};

window.openBankSubView = (type) => {
    const perm = window.SUBVIEW_PERM[type];
    if (perm && !window.hasPermission(perm)) return window.toast("Bu bo'limga ruxsat yo'q", true);

    window.curBankSub = type;
    window.ctxSectionLabel = window.SUBVIEW_LABELS[type] || type;
    window.ctxDetailLabel = "";

    window.el('bank-main-menu').classList.add('hidden');
    ['plan', 'sched', 'credit', 'dep', 'debt'].forEach(s => { if(window.el('bank-sub-'+s)) window.el('bank-sub-'+s).classList.add('hidden'); });
    window.el('bank-sub-'+type).classList.remove('hidden');
    window.el('main-menu-btn-top').classList.add('hidden');
    window.el('back-btn').classList.remove('hidden');

    let titles = { 
        'plan': '<span>🛒</span> <span>Bozorlik</span>',
        'sched': '<span>📅</span> <span>Rejali to\'lovlar</span>',
        'credit': '<span>💳</span> <span>Kreditlar</span>', 
        'dep': '<span>🏦</span> <span>Omonatlar</span>', 
        'debt': '<span>🤝</span> <span>Qarzlar</span>' 
    };
    window.setHtml('sub-view-title', titles[type]);
    window.updateSubViewContext();

    if(type === 'credit' && window.switchCrTab) window.switchCrTab('aktiv');
    if(type === 'dep' && window.switchDepTab) window.switchDepTab('aktiv');
    if(type === 'plan') {
        if (window.updatePlanCats) window.updatePlanCats();
        if (window.switchPlanTab) window.switchPlanTab('add');
    }
    if(type === 'sched' && window.el('sched-cat')) {
        window.ctxDetailLabel = window.val('sched-cat') || "";
        window.updateSubViewContext();
    }
};

window.closeBankSubView = () => {
    window.curBankSub = null;
    window.ctxSectionLabel = "";
    window.ctxDetailLabel = "";
    ['plan', 'sched', 'credit', 'dep', 'debt'].forEach(s => { if(window.el('bank-sub-'+s)) window.el('bank-sub-'+s).classList.add('hidden'); });
    window.el('bank-main-menu').classList.remove('hidden');
    window.el('back-btn').classList.add('hidden');
    window.el('main-menu-btn-top').classList.remove('hidden');
    window.updateSubViewContext();
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

window.initDragAndDrop = function() {
    const menu = window.el('bank-main-menu'); if(!menu) return;
    let dragEl = null, pressTimer = null;

    const savedOrder = JSON.parse(localStorage.getItem('menu_order_v1'));
    if(savedOrder) { savedOrder.forEach(id => { const item = menu.querySelector(`[data-id="${id}"]`); if(item) menu.appendChild(item); }); }

    menu.addEventListener('touchstart', e => {
        let target = e.target.closest('.main-menu-btn');
        if(!target) return;
        pressTimer = setTimeout(() => {
            dragEl = target; dragEl.classList.add('dragging');
            if(navigator.vibrate) navigator.vibrate(50);
        }, 500); 
    }, {passive: true});

    menu.addEventListener('touchmove', e => {
        if(!dragEl) { clearTimeout(pressTimer); return; }
        e.preventDefault(); 
        let touch = e.touches[0];
        let elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);
        let dropTarget = elemBelow ? elemBelow.closest('.main-menu-btn') : null;
        
        if(dropTarget && dropTarget !== dragEl) {
            let rect = dropTarget.getBoundingClientRect();
            let next = (touch.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;
            menu.insertBefore(dragEl, next ? dropTarget.nextSibling : dropTarget);
        }
    }, {passive: false});

    const endDrag = () => {
        clearTimeout(pressTimer);
        if(dragEl) {
            dragEl.classList.remove('dragging'); dragEl = null;
            let order = Array.from(menu.children).map(c => c.getAttribute('data-id'));
            localStorage.setItem('menu_order_v1', JSON.stringify(order));
        }
    };
    menu.addEventListener('touchend', endDrag); menu.addEventListener('touchcancel', endDrag);
};
