// ==========================================
// UI.JS - Modallar, Navigatsiya, Drag & Drop
// ==========================================

window.openModal = id => { window.el(id).style.display = "flex"; }; 
window.closeModal = id => { window.el(id).style.display = "none"; }; 
window.closeModalOutside = (e, id) => { if(e.target.id === id) window.closeModal(id); };

window.toggleSidebar = () => { 
    const m = window.el("sidebar-menu"), o = window.el("sidebar-overlay"); 
    if (m.classList.contains("open")) { m.classList.remove("open"); o.style.display="none"; } 
    else { m.classList.add("open"); o.style.display="block"; } 
};

window.renderSidebar = function() {
    let h = window.state.profiles.map(p => `<div class="sidebar-item ${p.id === window.curProf ? 'active' : ''}" onclick="selectProfile('${p.id}')"><div class="sidebar-avatar">${p.icon}</div><div>${p.name}</div></div>`).join("");
    h += `<div class="sidebar-item" onclick="openModal('modal-profile')" style="border:1px dashed var(--border-color); justify-content:center; opacity:0.8; margin-top:15px;"><div>➕ Yangi qo'shish</div></div>`;
    window.setHtml("sidebar-profiles-list", h); 
    window.setTxt("current-profile-name", window.state.profiles.find(x => x.id === window.curProf)?.name || "Umumiy");
};

window.selectProfile = id => { 
    window.curProf = id; window.actMainCat = null; window.actSubCat = null; 
    window.toggleSidebar(); window.renderSidebar(); window.checkAccess(); 
    if(window.updatePlanCats) window.updatePlanCats(); 
    if(window.render) window.render(); 
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
    const isChild = p && p.age !== null && p.age < 16 && p.id !== "general" && p.id !== "home_profile"; 
    if(isChild) { 
        window.hide("nav-other"); window.hide("mode-inc"); window.hide("rep-inc-card"); window.hide("user-stats-container"); 
        if(window.curTab === "other") window.switchTab("home"); 
        if(window.addMode !== "expense" && window.setAddMode) window.setAddMode("expense"); 
    } else { 
        window.show("nav-other"); window.show("mode-inc"); window.show("rep-inc-card"); window.show("user-stats-container"); 
    } 
};

window.switchTab = id => { 
    window.curTab = id; 
    document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active")); 
    if(window.el("nav-"+id)) window.el("nav-"+id).classList.add("active"); 
    
    ["home", "add", "other", "report"].forEach(t => { 
        const e = window.el("tab-"+t); 
        if(e) { if(t===id) e.classList.remove('hidden'); else e.classList.add('hidden'); } 
    }); 
    
    if(id !== 'other' && window.el('back-btn') && !window.el('back-btn').classList.contains('hidden')) { window.closeBankSubView(); }
    if(id === 'add') window.checkAccess(); 
    if(id === 'home' && window.updatePlanCats) window.updatePlanCats(); 
    if(window.render) window.render(); 
};

window.initCloseActionOld = (actionFunc) => { window.confirmActionOld = actionFunc; window.setVal("confirm-code", ""); window.openModal("modal-confirm"); };
window.executeConfirmOld = () => { if(window.val("confirm-code").trim() !== "YOPISH") return window.toast("Xato: YOPISH deb yozing!", true); if(window.confirmActionOld) window.confirmActionOld(); window.closeModal("modal-confirm"); window.confirmActionOld = null; };

window.openUniversalConfirm = (text, actionFunc) => { window.setTxt("yn-confirm-text", text); window.confirmActionYN = actionFunc; window.openModal("modal-yn-confirm"); };
window.executeConfirmYN = () => { if(window.confirmActionYN) window.confirmActionYN(); window.closeModal("modal-yn-confirm"); window.confirmActionYN = null; };

window.openBankSubView = (type) => {
    window.el('bank-main-menu').classList.add('hidden');
    ['plan', 'sched', 'credit', 'dep', 'debt'].forEach(s => { if(window.el('bank-sub-'+s)) window.el('bank-sub-'+s).classList.add('hidden'); });
    window.el('bank-sub-'+type).classList.remove('hidden');
    window.el('main-menu-btn-top').classList.add('hidden');
    window.el('back-btn').classList.remove('hidden');

    let titles = { 
        'plan': '<span style="font-size:24px;">🛒</span> <span style="font-size:20px;">Bozorlik</span>',
        'sched': '<span style="font-size:24px;">📅</span> <span style="font-size:20px;">Rejali to\'lovlar</span>',
        'credit': '<span style="font-size:28px;">💳</span> <span style="font-size:22px;">Kreditlar</span>', 
        'dep': '<span style="font-size:28px;">🏦</span> <span style="font-size:22px;">Omonatlar</span>', 
        'debt': '<span style="font-size:24px;">🤝</span> <span style="font-size:20px;">Qarzlar</span>' 
    };
    window.setHtml('sub-view-title', titles[type]);

    if(type === 'credit' && window.switchCrTab) window.switchCrTab('aktiv');
    if(type === 'dep' && window.switchDepTab) window.switchDepTab('aktiv');
};

window.closeBankSubView = () => {
    ['plan', 'sched', 'credit', 'dep', 'debt'].forEach(s => { if(window.el('bank-sub-'+s)) window.el('bank-sub-'+s).classList.add('hidden'); });
    window.el('bank-main-menu').classList.remove('hidden');
    window.el('back-btn').classList.add('hidden');
    window.el('main-menu-btn-top').classList.remove('hidden');
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
