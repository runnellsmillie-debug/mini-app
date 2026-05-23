// ==========================================
// BULUTLI SINXRONIZATSIYA VA API SOZLAMALARI
// ==========================================
const API_BASE = window.API_BASE || "https://mini-app-1.onrender.com";
const urlParams = new URLSearchParams(window.location.search);

function parseBidFromHash() {
    const h = (window.location.hash || "").replace(/^#/, "");
    if (!h) return null;
    const m = h.match(/(?:^|&)bid=(\d+)/) || h.match(/^bid=(\d+)/);
    return m ? m[1] : (/^\d+$/.test(h) ? h : null);
}

window.currentBudgetId = urlParams.get('bid') || parseBidFromHash();
window.tgUserId = urlParams.get('uid');
window.tgFirstName = urlParams.get('fname') || '';
window.isAdmin = urlParams.get('isadmin') === 'true';
window._ownBudgetId = null;
window._invitedBudgetId = null;
try {
    if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
        const u = window.Telegram.WebApp.initDataUnsafe.user;
        window.tgUser = u.first_name || window.tgUser;
        if (!window.tgFirstName) window.tgFirstName = u.first_name || '';
        if (!window.tgUserId) window.tgUserId = String(u.id);
    }
} catch (e) {}

window.sessionData = window.sessionData || []; 
window.amtStr = ""; 
window.curProf = "general"; // Default profil

// ==========================================
// 1. DASTUR HOLATI (STATE)
// ==========================================
window.state = {
    txs: [], plan: [], sched: [], debts: [], incs: [], profiles: [], deps: [], credits: [], theme: 'auto', lang: 'uz'
};

window.getStateStorageKey = function(bid) {
    const id = bid || window.currentBudgetId;
    return id ? `family_erp_state_${id}` : "family_erp_state";
};

window.isOnSharedFamilyBudget = function() {
    return window._invitedBudgetId != null
        && window.currentBudgetId
        && String(window.currentBudgetId) === String(window._invitedBudgetId);
};

window.isBudgetCreatorView = function() {
    return window._ownBudgetId != null
        && window.currentBudgetId
        && String(window.currentBudgetId) === String(window._ownBudgetId);
};

window.getEmptyState = function() {
    return {
        txs: [], plan: [], sched: [], debts: [], incs: [], profiles: [], deps: [], credits: [],
        audit: [], theme: "auto", lang: "uz", catOrders: {}, catHidden: {}, wallets: {},
        walletLedger: [], chats: {}
    };
};

window.applyCloudState = function(data) {
    window.state = { ...window.getEmptyState(), ...data };
    if (!window.state.profiles || !window.state.profiles.length) {
        window.state.profiles = window.DEFAULT_PROFILES
            ? window.DEFAULT_PROFILES.map(p => ({ ...p, permissions: [...(p.permissions || [])] }))
            : [];
    }
    localStorage.setItem(window.getStateStorageKey(), JSON.stringify(window.state));
    window._cloudLoadedAtStart = true;
    if (window.onCloudStateApplied) window.onCloudStateApplied();
};

window.fetchCloudState = async function(bid) {
    bid = bid || window.currentBudgetId;
    if (!bid) return null;
    try {
        const res = await fetch(`${API_BASE}/api/state/${bid}`);
        if (!res.ok) return null;
        const json = await res.json();
        if (json.status === "ok" && json.data && Object.keys(json.data).length > 0) {
            return json.data;
        }
    } catch (e) {
        console.error("Bulutdan o'qish xatosi:", e);
    }
    return null;
};

window.migrateLegacyStorage = function() {
    const legacy = localStorage.getItem("family_erp_state") || localStorage.getItem("xarajat_pro_v8");
    if (!legacy || !window.currentBudgetId) return;
    const key = window.getStateStorageKey();
    if (!localStorage.getItem(key)) localStorage.setItem(key, legacy);
};

window.resolveBudgetFromServer = async function() {
    const uid = window.tgUserId ? String(window.tgUserId).replace(/\D/g, "") : "";
    if (!uid) return false;
    try {
        const res = await fetch(`${API_BASE}/api/user-budget/${uid}`);
        if (!res.ok) return false;
        const json = await res.json();
        if (json.status !== "ok") return false;
        window._ownBudgetId = json.own_budget_id;
        window._invitedBudgetId = json.invited_budget_id;
        if (json.current_budget_id) {
            window.currentBudgetId = String(json.current_budget_id);
            window.isAdmin = json.is_own_account === true;
        }
        return true;
    } catch (e) {
        console.error("Hisob ID aniqlash xatosi:", e);
        return false;
    }
};

// ==========================================
// 2. MA'LUMOTLARNI YUKLASH (Bulut va Kesh)
// ==========================================
window.initCloudData = async function() {
    window._cloudLoadedAtStart = false;
    await window.resolveBudgetFromServer();
    window.migrateLegacyStorage();

    const cloudState = await window.fetchCloudState();

    if (cloudState) {
        window.applyCloudState(cloudState);
        postLoadInit();
        return;
    }

    const isCreator = window.isBudgetAdmin() || window.isBudgetCreatorView();

    if (isCreator) {
        const raw = localStorage.getItem(window.getStateStorageKey())
            || localStorage.getItem("family_erp_state")
            || localStorage.getItem("xarajat_pro_v8");
        if (raw) {
            try { window.state = { ...window.getEmptyState(), ...JSON.parse(raw) }; } catch (e) {}
        }
        postLoadInit();
        window.save(true);
        return;
    }

    window.state = window.getEmptyState();
    localStorage.removeItem(window.getStateStorageKey());
    postLoadInit();
    if (window.toast) {
        window.toast(window.t ? window.t("cloud_wait_creator") : "Yaratuvchi ma'lumotlari yuklanmoqda...", false);
    }
};

window.updateBudgetInfo = function() {};

async function postLoadInit() {
    window.normalizeAllProfiles();
    if (window.isBudgetAdmin() && !window._cloudLoadedAtStart) {
        const n = window.state.profiles.length;
        window.ensureCreatorProfile();
        if (window.state.profiles.length > n) window.save(true);
    } else if (window.tgUserId && window.ensureInvitedProfileLink && !window._cloudLoadedAtStart) {
        window.ensureInvitedProfileLink();
    }
    ['txs','incs','debts','sched','plan','deps','credits','audit'].forEach(k => { if(!window.state[k]) window.state[k] = []; });
    if (!window.state.catOrders) window.state.catOrders = {};
    if (!window.state.catHidden) window.state.catHidden = {};

    if (window.isBudgetAdmin()) {
        if(document.getElementById('admin-add-prof-btn')) document.getElementById('admin-add-prof-btn').style.display = 'block';
        if(document.getElementById('admin-reset-btn')) document.getElementById('admin-reset-btn').style.display = 'block';
    }

    window.applyTheme();
    window.applyModulePermissions();

    const hm = window.el("header-main");
    if (hm && !window.curBankSub) hm.classList.remove("hidden");
    if (window.updateHeaderBalance) window.updateHeaderBalance();
    
    if(window.loadExternalData) await window.loadExternalData();
    
    // Sanalarni bugungi kunga to'g'rilash
    const t = new Date().toISOString().slice(0,10);
    window.setVal("rep-from", t); window.setVal("rep-to", t); window.setVal("debt-start", t); window.setVal("dep-date", t); window.setVal("credit-date", t);
    
    // UI qismlarini yuklash
    if(window.renderSidebar) window.renderSidebar();
    if(window.updatePlanCats) window.updatePlanCats();
    if(window.initDragAndDrop) window.initDragAndDrop();
    if(window.tryAutoLinkProfile) window.tryAutoLinkProfile();
    if(window.renderAddProfileStrip) window.renderAddProfileStrip();
    if(window.syncPlanPriceDisplay) window.syncPlanPriceDisplay();
    if(window.initAddKeyboard) window.initAddKeyboard();
    if(window.syncDescDisplay) window.syncDescDisplay();
    if(window.setupAddCatDrag) window.setupAddCatDrag();
    if(window.syncAddLayout) window.syncAddLayout();
    if(window.ensureHomeState) window.ensureHomeState();
    if(window.applyLang) window.applyLang();
    
    window.render();
}

// ==========================================
// 3. TIL VA MAVZU (THEME) SOZLAMALARI
// ==========================================
window.setLang = function(lang) {
    if (!["uz", "ru", "en"].includes(lang)) return;
    window.state.lang = lang;
    window.save(true);
    if (window.applyLang) window.applyLang();
};

window.syncSettingsUI = function() {
    const lang = window.state.lang || "uz";
    document.querySelectorAll(".settings-flag-btn").forEach(btn => {
        btn.classList.toggle("active", btn.getAttribute("data-lang") === lang);
    });
    const theme = window.state.theme || "auto";
    document.querySelectorAll(".settings-theme-btn").forEach(btn => {
        btn.classList.toggle("active", btn.getAttribute("data-theme") === theme);
    });
};

window.applyTheme = function() {
    let theme = window.state.theme || 'auto';
    let isDark = false;

    if (theme === 'auto') {
        let d = new Date();
        let utc = d.getTime() + (d.getTimezoneOffset() * 60000);
        let uzbDate = new Date(utc + (3600000 * 5));
        let h = uzbDate.getHours();
        isDark = (h >= 19 || h < 6);
    } else {
        isDark = (theme === 'dark');
    }

    document.body.classList.toggle('dark-mode', isDark);
    if (window.syncSettingsUI) window.syncSettingsUI();
};

window.setTheme = function(theme) {
    window.state.theme = theme; window.save(true); window.applyTheme();
};

setInterval(() => { if (window.state.theme === 'auto' || !window.state.theme) window.applyTheme(); }, 60000);

// ==========================================
// 4. TO'LIQ EKRANLI PROFIL TAHRIRLASH
// ==========================================
window.openFullScreenModal = function(profId = null) {
    if (!window.isBudgetAdmin()) return window.toast("Faqat yaratuvchi profil qo'sha/tahrirlaydi", true);
    document.getElementById('modal-profile-fs').style.display = 'flex';
    document.getElementById('fs-prof-id').value = profId || '';
    if (window.el('fs-prof-pin-enabled')) window.el('fs-prof-pin-enabled').checked = false;
    if (window.el('fs-prof-pin')) window.el('fs-prof-pin').value = '';
    if (window.el('fs-prof-age')) window.el('fs-prof-age').value = '';
    if (window.el('fs-prof-limit')) window.el('fs-prof-limit').value = '';
    if (window.el('fs-prof-phone')) window.el('fs-prof-phone').value = '';
    if (window.el('fs-prof-uid')) window.el('fs-prof-uid').value = '';

    let perms = [];
    if (profId) {
        document.getElementById('fs-prof-title').innerText = window.t ? window.t("edit_profile") : "Profilni tahrirlash";
        let p = window.state.profiles.find(x => x.id === profId);
        if (p) {
            document.getElementById('fs-prof-name').value = p.name || '';
            document.getElementById('fs-prof-emoji').value = p.icon || '👤';
            document.getElementById('fs-prof-role').value = p.role || 'child_m';
            if (window.el('fs-prof-age')) window.el('fs-prof-age').value = p.age != null ? p.age : '';
            if (window.el('fs-prof-limit')) window.el('fs-prof-limit').value = p.monthlyLimit ? String(p.monthlyLimit).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : '';
            if (window.el('fs-prof-pin-enabled')) window.el('fs-prof-pin-enabled').checked = !!p.pinEnabled;
            perms = p.permissions || [];
            if (window.el('fs-prof-phone')) window.el('fs-prof-phone').value = p.linked_phone || '';
            if (window.el('fs-prof-uid')) window.el('fs-prof-uid').value = p.linked_uid ? String(p.linked_uid) : '';
            if (window.renderWalletManageGrid) window.renderWalletManageGrid(profId, p.walletManage || []);
        }
    } else {
        document.getElementById('fs-prof-title').innerText = window.t ? window.t("new_profile") : "Yangi profil";
        document.getElementById('fs-prof-name').value = '';
        document.getElementById('fs-prof-emoji').value = '👤';
        document.getElementById('fs-prof-role').value = 'child_f';
        perms = [...window.DEFAULT_NEW_PROFILE_PERMS];
        if (window.renderWalletManageGrid) window.renderWalletManageGrid(null, []);
    }
    window._permExpandedGroups = new Set();
    if (window.renderProfilePermsGrid) window.renderProfilePermsGrid(perms);
};

window.closeFullScreenModal = function() {
    document.getElementById('modal-profile-fs').style.display = 'none';
};

window.fillLinkedUidFromCurrentUser = function() {
    if (!window.tgUserId) return window.toast("Telegram ID topilmadi", true);
    window.setVal("fs-prof-uid", String(window.tgUserId));
    window.toast("ID qo'yildi");
};

window.saveFullScreenProfile = function() {
    if (!window.isBudgetAdmin()) return window.toast("Ruxsat yo'q", true);
    let id = document.getElementById('fs-prof-id').value;
    let name = document.getElementById('fs-prof-name').value.trim();
    let icon = document.getElementById('fs-prof-emoji').value.trim() || '👤';
    let role = document.getElementById('fs-prof-role').value;
    let ageVal = window.el('fs-prof-age') ? window.val('fs-prof-age') : '';
    let age = ageVal !== '' ? parseInt(ageVal, 10) : null;
    let monthlyLimit = window.getNum ? window.getNum('fs-prof-limit') : (parseInt((window.val('fs-prof-limit') || '').replace(/\s/g, ''), 10) || 0);
    let perms = Array.from(document.querySelectorAll('.fs-perm-chk:checked')).map(chk => chk.value);
    let walletManage = window.getWalletManageChecked ? window.getWalletManageChecked() : [];
    let pinEnabled = window.el('fs-prof-pin-enabled')?.checked;
    let pinRaw = (window.val('fs-prof-pin') || '').replace(/\D/g, '');

    if(!name) return alert("Ismni kiriting!");

    const linkedPhone = (window.val('fs-prof-phone') || '').trim();
    const linkedUidRaw = (window.val('fs-prof-uid') || '').trim().replace(/\D/g, '');
    const linkedUid = linkedUidRaw ? linkedUidRaw : null;

    const build = (base) => window.normalizeProfile({
        ...base, name, icon, role, age, monthlyLimit, permissions: perms,
        walletManage,
        permsConfigured: true,
        pinEnabled: !!pinEnabled,
        pinHash: pinRaw.length === 4 ? window.hashPin(pinRaw) : (base?.pinHash || ""),
        gender: role.endsWith('_f') ? 'f' : role.endsWith('_m') ? 'm' : '',
        linked_phone: linkedPhone,
        linked_uid: linkedUid
    });

    if (id) {
        let p = window.state.profiles.find(x => x.id === id);
        if (p) {
            const updated = build(p);
            if (pinRaw.length !== 4) updated.pinHash = p.pinHash;
            Object.assign(p, updated);
            window.logAudit('profile_edit', name, { prof: id });
        }
    } else {
        const np = build({ id: 'prof_' + Date.now(), linked_phone: '', linked_uid: null });
        window.state.profiles.push(np);
        id = np.id;
        window.logAudit('profile_create', name, { prof: np.id });
    }
    window.save(true);
    closeFullScreenModal();
    window.requestProfileAccess(id, () => {
        window.curProf = id;
        window.actMainCat = null;
        window.actSubCat = null;
        const p = window.state.profiles.find(x => x.id === id);
        if (document.getElementById('current-profile-name')) {
            document.getElementById('current-profile-name').innerText = p?.name || 'Profil';
        }
        window.applyModulePermissions();
        if (window.closeBankSubViewIfDenied) window.closeBankSubViewIfDenied();
        if (window.updatePlanCats) window.updatePlanCats();
        if (window.renderSidebar) window.renderSidebar();
        if (window.renderAddProfileStrip) window.renderAddProfileStrip();
        if (window.render) window.render();
        if (window.checkAccess) window.checkAccess();
        window.toast('Profil saqlandi');
    });
};

window.deleteFullScreenProfile = function() {
    if (!window.isBudgetAdmin()) return window.toast("Ruxsat yo'q", true);
    let id = document.getElementById('fs-prof-id').value;
    if(!id) return alert("Bu yangi profil, u hali saqlanmagan.");
    if (window.PROTECTED_PROFILE_IDS.includes(id) || id.startsWith('creator_')) return alert("Bu profilni o'chirib bo'lmaydi!");
    if(confirm("Profilni butunlay o'chirasizmi?")) {
        window.state.profiles = window.state.profiles.filter(x => x.id !== id);
        if(window.curProf === id) window.curProf = 'general';
        window.logAudit('profile_delete', id);
        window.save(true);
        closeFullScreenModal();
        if(window.renderSidebar) window.renderSidebar();
        window.render();
    }
};

window.selectProfileSafe = function(profId) {
    window.requestProfileAccess(profId, () => {
        window.curProf = profId;
        window.actMainCat = null;
        window.actSubCat = null;
        const p = window.state.profiles.find(x => x.id === profId);
        if (document.getElementById('current-profile-name')) document.getElementById('current-profile-name').innerText = p?.name || 'Umumiy';
        const sidebar = window.el("sidebar-menu");
        if (sidebar && sidebar.classList.contains("open") && window.toggleSidebar) window.toggleSidebar();
        window.applyModulePermissions();
        if (window.closeBankSubViewIfDenied) window.closeBankSubViewIfDenied();
        if (window.updatePlanCats) window.updatePlanCats();
        if (window.renderSidebar) window.renderSidebar();
        if (window.renderAddProfileStrip) window.renderAddProfileStrip();
        if (window.render) window.render();
        if (window.checkAccess) window.checkAccess();
    });
};

// ==========================================
// 5. YON MENYU (SIDEBAR) VA STATISTIKA
// ==========================================
window.renderSidebar = function() {
    const list = document.getElementById("sidebar-profiles-list");
    if (!list) return;

    const sorted = window.getSortedProfiles ? window.getSortedProfiles() : window.state.profiles.filter(p => !p.archived);

    let html = "";
    if (window.isBudgetAdmin()) {
        html += `<div class="profile-hint-admin">${window.t("profile_hint_admin")}</div>`;
    }
    sorted.forEach(p => {
        const spent = window.getProfileMonthSpend(p.id);
        const lim = window.getLimitStatus(p.id);
        let warn = lim.level === "danger" ? " ⚠️" : lim.level === "warn" ? " 🟡" : "";
        const lock = window.needsPin(p.id) ? " 🔒" : "";
        const activeCls = window.curProf === p.id ? " active-profile" : "";
        const linkBadge = p.linked_uid ? `<span class="profile-link-badge" title="${window.t("linked_title")}">📲</span>` : "";
        const limitTxt = p.monthlyLimit > 0
            ? `<span class="profile-limit">${window.t("limit_prefix")} ${lim.pct || 0}%</span>`
            : "";

        html += `
        <div class="list-item profile-row profile-row--compact${activeCls}" data-prof-id="${p.id}">
            <span class="profile-avatar profile-avatar--sm" title="${window.t("profile_hold_settings")}">${p.icon}${warn}${lock}</span>
            <div class="profile-meta">
                <div class="profile-name">${p.name}${linkBadge}</div>
                <div class="profile-spend">${window.t("month_prefix")} ${window.formatM(spent).replace(" so'm", "")}${limitTxt}</div>
            </div>
            ${window.curProf === p.id ? '<span class="profile-active-dot"></span>' : ""}
        </div>`;
    });
    list.innerHTML = html;
    list.querySelectorAll(".profile-row").forEach(row => {
        const id = row.getAttribute("data-prof-id");
        if (id) window.initProfileRowPress(row, id);
    });
    const cur = window.state.profiles.find(x => x.id === window.curProf);
    if (document.getElementById('current-profile-name')) document.getElementById('current-profile-name').innerText = cur?.name || 'Umumiy';
};

// ==========================================
// 6. XAVFSIZ TOZALASH (HARD RESET)
// ==========================================
window.verifyAndReset = function() {
    const inputId = document.getElementById("reset-admin-id").value;
    const TRUE_ADMIN_ID = "279410924"; 
    
    if (inputId !== TRUE_ADMIN_ID) {
        alert("❌ Xato! Sizda dasturni tozalash huquqi yo'q (ID noto'g'ri).");
        document.getElementById('reset-modal').style.display='none';
        document.getElementById("reset-admin-id").value = "";
        return;
    }
    
    if (confirm("⚠️ DIQQAT! Barcha xarajatlar... Ishonchingiz komilmi?")) {
        localStorage.removeItem('family_erp_state');
        localStorage.removeItem('xarajat_pro_v8');
        if (window.currentBudgetId) localStorage.removeItem(window.getStateStorageKey());
        window.state = { txs: [], plan: [], sched: [], debts: [], incs: [], profiles: window.DEFAULT_PROFILES.map(p => ({ ...p, permissions: [...p.permissions] })), deps: [], credits: [], audit: [], theme: 'auto', lang: 'uz' };
        window.save(true);
        alert("✅ Tizim muvaffaqiyatli tozalandi.");
        document.getElementById('reset-modal').style.display='none';
        window.location.reload();
    }
};

window.save = function(force = false) {
    const storageKey = window.getStateStorageKey();
    localStorage.setItem(storageKey, JSON.stringify(window.state));
    if (window.currentBudgetId) {
        fetch(`${API_BASE}/api/state/${window.currentBudgetId}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(window.state)
        }).catch(err => console.error("Bulutga saqlash xatosi:", err));
    }
    if (!force && typeof window.render === 'function') window.render();
};

window.saveAndExit = () => { 
    window.save(true);
    if(window.sessionData && window.sessionData.length>0 && window.Telegram?.WebApp) {
        window.Telegram.WebApp.sendData(JSON.stringify(window.sessionData)); 
    } else if(window.Telegram?.WebApp) {
        window.Telegram.WebApp.close(); 
    } else {
        window.toast("Saqlandi!"); 
    }
};

// ==========================================
// 7. ASOSIY BOSHQRUV VA UI
// ==========================================
window.setAddMode = m => { 
    window.addMode = m; window.actMainCat = null; window.actSubCat = null; 
    window.exitCatEditMode(true);
    const exp = window.el("mode-exp"), inc = window.el("mode-inc");
    if (exp) { exp.classList.toggle("mode-btn--active-exp", m === "expense"); exp.classList.toggle("mode-btn--active", m === "expense"); exp.classList.remove("mode-btn--panel-open"); }
    if (inc) { inc.classList.toggle("mode-btn--active-inc", m === "income"); inc.classList.toggle("mode-btn--active", m === "income"); }
    window.setHtml("stay-hint",""); window.renderAddCats();
    if (window.focusAddAmount) window.focusAddAmount();
};

window.onModeExpClick = function() {
    if (window.addMode !== "expense") window.setAddMode("expense");
};

window.getTodayTxList = function() {
    const today = new Date().toISOString().slice(0, 10);
    return window.state.txs
        .filter(x => x.date === today && (window.curProf === "general" || x.prof === window.curProf))
        .sort((a, b) => b.amount - a.amount);
};

window.getTodayExpense = function(profId) {
    const p = profId || window.curProf;
    const today = new Date().toISOString().slice(0, 10);
    const match = x => x.date === today && (p === "general" || x.prof === p);
    return window.state.txs.filter(match).reduce((s, t) => s + t.amount, 0);
};

window.fmtHeaderTxRow = function(x) {
    const title = (x.desc || x.subCat || x.cat || "Xarajat").replace(/</g, "&lt;");
    const user = (x.user || "Siz").replace(/</g, "&lt;");
    const time = x.time || "";
    return `<div class="header-float-row"><div class="header-float-row__main"><div class="header-float-row__title">${title}</div><div class="header-float-row__meta">👤 ${user}${time ? " · " + time : ""}</div></div><span class="header-float-row__amt">${window.formatM(x.amount)}</span></div>`;
};

window.getNotifSeenIds = function() {
    try { return new Set(JSON.parse(localStorage.getItem("family_notif_seen") || "[]")); }
    catch { return new Set(); }
};

window.getChatSeenIds = function(profId) {
    try { return new Set(JSON.parse(localStorage.getItem("chat_notif_seen_" + profId) || "[]")); }
    catch { return new Set(); }
};

window.saveChatSeenIds = function(profId, ids) {
    localStorage.setItem("chat_notif_seen_" + profId, JSON.stringify([...ids].slice(-300)));
};

window.getMyLinkedProfiles = function() {
    const me = window.tgUserId ? String(window.tgUserId) : "";
    if (!me) return [];
    return window.state.profiles.filter(p => !p.archived && p.linked_uid && String(p.linked_uid) === me);
};

window.getUnreadChatNotifs = function() {
    const me = window.tgUserId ? String(window.tgUserId) : "";
    if (!me) return [];
    const unread = [];
    const partners = window.getInvitedChatProfiles ? window.getInvitedChatProfiles() : [];
    partners.forEach(p => {
        const roomKey = window.getChatRoomKey ? window.getChatRoomKey(p.id) : p.id;
        const seen = window.getChatSeenIds(roomKey);
        const msgs = window.getChatMessagesFor ? window.getChatMessagesFor(p.id) : (window.state.chats?.[p.id] || []);
        msgs.forEach(m => {
            const mine = window.isChatMessageMine ? window.isChatMessageMine(m) : String(m.uid || "") === me;
            if (!mine && !seen.has(m.id)) {
                unread.push({ ...m, profId: p.id, profName: p.name, profIcon: p.icon, kind: "chat" });
            }
        });
    });
    return unread.sort((a, b) => b.id - a.id);
};

window.saveNotifSeenIds = function(ids) {
    localStorage.setItem("family_notif_seen", JSON.stringify([...ids].slice(-500)));
};

window.fmtHeaderChatRow = function(m) {
    const title = (m.text || "").replace(/</g, "&lt;");
    const user = (m.user || "Siz").replace(/</g, "&lt;");
    const prof = `${m.profIcon || "👤"} ${(m.profName || "").replace(/</g, "&lt;")}`;
    return `<div class="header-float-row header-float-row--chat"><div class="header-float-row__main"><div class="header-float-row__title">💬 ${title}</div><div class="header-float-row__meta">${prof} · 👤 ${user}${m.time ? " · " + m.time : ""}</div></div></div>`;
};

window.getFamilyNotifTxs = function() {
    const me = window.tgUser;
    const today = new Date().toISOString().slice(0, 10);
    return window.state.txs
        .filter(x => x.date === today && (window.curProf === "general" || x.prof === window.curProf))
        .filter(x => (x.user || "Siz") !== me)
        .sort((a, b) => b.id - a.id);
};

window.getUnreadFamilyNotifTxs = function() {
    const seen = window.getNotifSeenIds();
    return window.getFamilyNotifTxs().filter(x => !seen.has(x.id));
};

window.getAllUnreadNotifs = function() {
    const txUnread = window.getUnreadFamilyNotifTxs().map(x => ({ ...x, kind: "expense" }));
    const chatUnread = window.getUnreadChatNotifs();
    return [...chatUnread, ...txUnread].sort((a, b) => b.id - a.id);
};

window.updateHeaderNotifications = function() {
    const unread = window.getAllUnreadNotifs();
    const badge = window.el("header-bell-badge");
    const bell = window.el("header-bell-btn");
    if (badge) {
        if (unread.length) {
            badge.textContent = unread.length > 9 ? "9+" : String(unread.length);
            badge.classList.remove("hidden");
        } else {
            badge.classList.add("hidden");
        }
    }
    if (bell) {
        bell.classList.toggle("header-bell-btn--shake", unread.length > 0 && !window.headerNotifOpen);
        bell.classList.toggle("header-bell-btn--unread", unread.length > 0);
    }
};

window.renderHeaderTodayPanel = function() {
    const list = window.el("header-today-list");
    if (!list) return;
    const txs = window.getTodayTxList();
    list.innerHTML = txs.length
        ? txs.map(x => window.fmtHeaderTxRow(x)).join("")
        : `<div class="header-float-empty">Bugun xarajat yo'q</div>`;
};

window.renderHeaderNotifPanel = function() {
    const list = window.el("header-notif-list");
    if (!list) return;
    const chats = window.getUnreadChatNotifs();
    const txs = window.getFamilyNotifTxs();
    const parts = [];
    if (chats.length) {
        parts.push(`<div class="header-float-section">${window.t ? window.t("chat_messages") : "Chat xabarlari"}</div>`);
        parts.push(chats.map(x => window.fmtHeaderChatRow(x)).join(""));
    }
    if (txs.length) {
        parts.push(`<div class="header-float-section">${window.t ? window.t("family_expenses") : "Oilaviy xarajatlar"}</div>`);
        parts.push(txs.map(x => window.fmtHeaderTxRow(x)).join(""));
    }
    list.innerHTML = parts.length
        ? parts.join("")
        : `<div class="header-float-empty">${window.t ? window.t("notif_empty") : "Xabar yo'q"}</div>`;
};

window.closeHeaderPanels = function() {
    window.headerTodayOpen = false;
    window.headerNotifOpen = false;
    window.el("header-today-panel")?.classList.add("hidden");
    window.el("header-notif-panel")?.classList.add("hidden");
    window.el("header-panel-overlay")?.classList.add("hidden");
    window.el("header-today-btn")?.classList.remove("header-stat-btn--active");
    window.updateHeaderNotifications();
};

window.toggleHeaderTodayPanel = function() {
    const open = !window.headerTodayOpen;
    window.closeHeaderPanels();
    if (!open) return;
    window.headerTodayOpen = true;
    window.renderHeaderTodayPanel();
    window.el("header-today-panel")?.classList.remove("hidden");
    window.el("header-panel-overlay")?.classList.remove("hidden");
    window.el("header-today-btn")?.classList.add("header-stat-btn--active");
};

window.toggleHeaderNotifPanel = function() {
    const open = !window.headerNotifOpen;
    window.closeHeaderPanels();
    if (!open) return;
    window.headerNotifOpen = true;
    window.renderHeaderNotifPanel();
    window.el("header-notif-panel")?.classList.remove("hidden");
    window.el("header-panel-overlay")?.classList.remove("hidden");
    const seen = window.getNotifSeenIds();
    window.getFamilyNotifTxs().forEach(x => seen.add(x.id));
    window.saveNotifSeenIds(seen);
    if (window.getInvitedChatProfiles && window.markChatRead) {
        window.getInvitedChatProfiles().forEach(p => window.markChatRead(p.id));
    } else {
        window.getMyLinkedProfiles().forEach(p => {
            const chatSeen = window.getChatSeenIds(p.id);
            (window.state.chats?.[p.id] || []).forEach(m => chatSeen.add(m.id));
            window.saveChatSeenIds(p.id, chatSeen);
        });
    }
    window.updateHeaderNotifications();
};

window.getAddCatLevel = function() {
    if (window.addMode === "income") return "main";
    if (window.actSubCat) return "items";
    if (window.actMainCat) return "rukun";
    return "main";
};

window.getCatOrderKey = function(level, parentId) {
    return `${window.curProf}::${level}::${parentId || "root"}`;
};

window.applyCatOrder = function(items, level, parentId) {
    if (!items || !items.length) return items;
    const order = window.state.catOrders?.[window.getCatOrderKey(level, parentId)];
    if (!order || !order.length) return items;
    const map = new Map(items.map(c => [c.id, c]));
    const sorted = order.filter(id => map.has(id)).map(id => map.get(id));
    items.forEach(c => { if (!order.includes(c.id)) sorted.push(c); });
    return sorted;
};

window.saveCatOrder = function(level, parentId, ids) {
    if (!window.state.catOrders) window.state.catOrders = {};
    window.state.catOrders[window.getCatOrderKey(level, parentId)] = ids;
    window.save(true);
};

window.getCatHiddenKey = function(level, parentId) {
    return window.getCatOrderKey(level, parentId);
};

window.isCatHidden = function(id, level, parentId) {
    if (!id) return false;
    const list = window.state.catHidden?.[window.getCatHiddenKey(level, parentId)] || [];
    return list.includes(id);
};

window.isSubFullyHidden = function(sub, mainCatId) {
    if (!sub) return true;
    if (window.isCatHidden(sub.id, "rukun", mainCatId)) return true;
    if (!sub.items?.length) return false;
    return sub.items.every(i => window.isCatHidden(i.id, "items", sub.id));
};

window.isMainCatFullyHidden = function(cat) {
    if (!cat) return true;
    if (window.isCatHidden(cat.id, "main", null)) return true;
    if (!cat.subs?.length) return false;
    return cat.subs.every(s => window.isSubFullyHidden(s, cat.id));
};

window.getCurrentCatItems = function(level, parentId) {
    if (level === "services") {
        const p = window.getActiveProfile ? window.getActiveProfile() : null;
        return window.SERVICE_ITEMS.filter(it => {
            const perm = window.SUBVIEW_PERM?.[it.id];
            return !perm || window.hasPermission(perm, p);
        });
    }
    if (window.addMode === "income") return window.INC_SOURCES.map((s, i) => ({ ...s, id: "inc_" + i }));
    if (level === "items" && window.actSubCat) return window.actSubCat.items || [];
    if (level === "rukun" && window.actMainCat) return window.actMainCat.subs || [];
    if (level === "main") return window.getCats();
    return [];
};

window.canHideAtLevel = function(id, level, parentId) {
    const storeParent = parentId === "root" ? null : (parentId === "income" ? "income" : parentId);
    const all = window.getCurrentCatItems(level, parentId);
    const visible = all.filter(i => !window.isCatHidden(i.id, level, storeParent));
    if (visible.length <= 1 && visible.some(i => i.id === id)) return false;
    return true;
};

window.cascadeHideSubIfEmpty = function(subId, mainCatId) {
    const main = window.actMainCat || window.getCats().find(c => c.id === mainCatId);
    const sub = main?.subs?.find(s => s.id === subId);
    if (!sub?.items?.length || !mainCatId) return;
    const allHidden = sub.items.every(i => window.isCatHidden(i.id, "items", subId));
    if (!allHidden) return;
    if (!window.state.catHidden) window.state.catHidden = {};
    const key = window.getCatHiddenKey("rukun", mainCatId);
    if (!window.state.catHidden[key]) window.state.catHidden[key] = [];
    if (!window.state.catHidden[key].includes(subId)) window.state.catHidden[key].push(subId);
};

window.cascadeRestoreSubChildren = function(subId) {
    const key = window.getCatHiddenKey("items", subId);
    if (window.state.catHidden?.[key]) delete window.state.catHidden[key];
};

window.cascadeRestoreMainChildren = function(mainCatId) {
    const cat = window.getCats().find(c => c.id === mainCatId);
    if (!cat?.subs) return;
    const rk = window.getCatHiddenKey("rukun", mainCatId);
    cat.subs.forEach(sub => {
        if (window.state.catHidden?.[rk]) {
            window.state.catHidden[rk] = window.state.catHidden[rk].filter(x => x !== sub.id);
        }
        window.cascadeRestoreSubChildren(sub.id);
    });
};

window.hideCatItem = function(id, level, parentId) {
    if (!id || id === "umumiy") return;
    const normParent = parentId === "root" ? null : (parentId === "income" ? "income" : parentId);
    if (!window.canHideAtLevel(id, level, parentId)) {
        window.toast(window.t("keep_one"), true);
        return;
    }
    if (!window.state.catHidden) window.state.catHidden = {};
    const key = window.getCatHiddenKey(level, normParent);
    if (!window.state.catHidden[key]) window.state.catHidden[key] = [];
    if (!window.state.catHidden[key].includes(id)) window.state.catHidden[key].push(id);

    if (level === "items" && normParent && window.actMainCat) {
        window.cascadeHideSubIfEmpty(normParent, window.actMainCat.id);
    }
    if (level === "rukun" && normParent) {
        const main = window.getCats().find(c => c.id === normParent);
        const sub = main?.subs?.find(s => s.id === id);
        if (sub?.items?.length) sub.items.forEach(i => {
            const ik = window.getCatHiddenKey("items", id);
            if (!window.state.catHidden[ik]) window.state.catHidden[ik] = [];
            if (!window.state.catHidden[ik].includes(i.id)) window.state.catHidden[ik].push(i.id);
        });
    }

    window.save(true);
    if (level === "services") {
        if (window.renderServicesMenu) window.renderServicesMenu();
    } else if (window.renderAddCats) {
        window.renderAddCats();
    }
};

window.restoreCatItem = function(id, level, parentId, silent) {
    if (!id) return;
    const normParent = parentId === "root" ? null : (parentId === "income" ? "income" : parentId);
    const key = window.getCatHiddenKey(level, normParent);
    if (window.state.catHidden?.[key]) {
        window.state.catHidden[key] = window.state.catHidden[key].filter(x => x !== id);
    }

    if (level === "rukun" && normParent) {
        window.cascadeRestoreSubChildren(id);
    }
    if (level === "main") {
        window.cascadeRestoreMainChildren(id);
    }

    window.save(true);
    if (!silent) {
        if (level === "services") {
            if (window.renderServicesMenu) window.renderServicesMenu();
        } else if (window.renderAddCats) {
            window.renderAddCats();
        }
    }
};

window.toggleCatHidden = function(id, level, parentId) {
    parentId = parentId === "root" ? null : parentId;
    if (window.isCatHidden(id, level, parentId)) window.restoreCatItem(id, level, parentId);
    else window.hideCatItem(id, level, parentId);
};

window.getUsedIncLabels = function() {
    const labels = new Set();
    const profMatch = x => window.curProf === "general" || x.prof === window.curProf;
    window.state.incs.filter(profMatch).forEach(x => {
        if (x.desc) labels.add(x.desc.trim().toLowerCase());
        if (x.cat) labels.add(x.cat.trim().toLowerCase());
    });
    return labels;
};

window.hasProfileIncs = function() {
    return window.state.incs.some(x => window.curProf === "general" || x.prof === window.curProf);
};

window.isIncItemUsed = function(item) {
    if (!window.hasProfileIncs()) return true;
    return window.getUsedIncLabels().has((item.label || "").trim().toLowerCase());
};

window.getUsedLabels = function() {
    const cats = new Set(), subs = new Set(), items = new Set();
    const profMatch = tx => window.curProf === "general" || tx.prof === window.curProf;
    window.state.txs.filter(profMatch).forEach(tx => {
        if (tx.cat) cats.add(tx.cat.trim().toLowerCase());
        const sub = (tx.subCat || "").trim().toLowerCase();
        if (sub) {
            subs.add(sub);
            sub.split("›").forEach(p => { const t = p.trim(); if (t) items.add(t); });
        }
        if (tx.desc) items.add(tx.desc.trim().toLowerCase());
    });
    return { cats, subs, items };
};

window.hasProfileTxs = function() {
    return window.state.txs.some(x => window.curProf === "general" || x.prof === window.curProf);
};

window.isItemUsed = function(item, level) {
    if (!window.hasProfileTxs()) return true;
    if (item.id === "boshqa" || item.id === "umumiy") return true;
    const lbl = (item.label || "").replace(" ✓", "").trim().toLowerCase();
    const u = window.getUsedLabels();
    if (level === "main") return u.cats.has(lbl);
    if (level === "rukun") {
        return u.subs.has(lbl) || [...u.items, ...u.subs].some(s => s.includes(lbl));
    }
    if (level === "items") {
        return u.items.has(lbl) || [...u.subs, ...u.items].some(s => s.includes(lbl));
    }
    return true;
};

window.filterCatItems = function(items, level, parentId) {
    let list = window.applyCatOrder([...items], level, parentId);
    const normParent = parentId === "root" ? null : (parentId === "income" ? "income" : parentId);
    const isHidden = id => window.isCatHidden(id, level, normParent);

    if (level === "main" && !window.catEditMode) {
        list = list.filter(c => !window.isMainCatFullyHidden(c));
    }
    if (level === "rukun" && parentId && !window.catEditMode) {
        list = list.filter(s => !window.isSubFullyHidden(s, parentId));
    }

    if (window.catEditMode) {
        return [...list.filter(i => !isHidden(i.id)), ...list.filter(i => isHidden(i.id))];
    }
    return list.filter(i => !isHidden(i.id));
};

window.enterCatEditMode = function(level, parentId) {
    window.catEditMode = true;
    window.catEditLevel = level;
    window.catEditParent = parentId === "root" ? null : parentId;
    window.el("add-cats-zone")?.classList.add("cats-zone--edit");
    window.renderAddCats();
    window.toast(window.t("sort_mode"));
};

window.exitCatEditMode = function(silent) {
    if (!window.catEditMode) return;
    window.catEditMode = false;
    window.catEditLevel = null;
    window.catEditParent = null;
    window.el("add-cats-zone")?.classList.remove("cats-zone--edit");
    window.renderAddCats();
    if (!silent) window.toast(window.t("ready"));
};

window.onHideCatClick = function(e, id, level, parentId) {
    e.stopPropagation();
    e.preventDefault();
    window.toggleCatHidden(id, level, parentId === "root" ? null : parentId);
};

window.onRestoreCatClick = function(e, id, level, parentId) {
    e.stopPropagation();
    e.preventDefault();
    window.restoreCatItem(id, level, parentId === "root" ? null : parentId);
};

window.setupAddCatDrag = function() {
    const zone = window.el("add-cats-zone") || document.querySelector(".add-cats-zone");
    const cont = window.el("cats-container");
    if (!zone || !cont) return;
    if (zone.dataset.dragSetup === "7") return;
    zone.dataset.dragSetup = "7";
    let dragEl = null, pressTimer = null, pressTarget = null;
    let startX = 0, startY = 0, scrollMode = false, lastScrollY = 0;
    const LONG_MS = 500, MOVE_PX = 14;

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

    const saveOrderFromGrid = (grid) => {
        if (!grid) return;
        const ids = Array.from(grid.querySelectorAll(".cat-btn--add[data-cat-id]")).map(b => b.getAttribute("data-cat-id"));
        const level = grid.getAttribute("data-level") || "main";
        const parent = grid.getAttribute("data-parent") || "root";
        window.saveCatOrder(level, parent === "root" ? null : parent, ids);
    };

    const endDrag = () => {
        clearPress();
        resetScroll();
        if (dragEl) {
            dragEl.classList.remove("dragging");
            saveOrderFromGrid(dragEl.closest(".cat-scroll--add"));
            dragEl = null;
        }
    };

    const beginLongPress = () => {
        pressTimer = null;
        if (!pressTarget) return;
        const grid = pressTarget.closest(".cat-scroll--add");
        const level = grid?.getAttribute("data-level") || "main";
        const parent = grid?.getAttribute("data-parent") || "root";
        window._blockCatTap = true;
        if (!window.catEditMode) window.enterCatEditMode(level, parent);
        if (navigator.vibrate) navigator.vibrate(50);
    };

    const beginDragHold = () => {
        pressTimer = null;
        if (!pressTarget || !window.catEditMode) return;
        const id = pressTarget.getAttribute("data-cat-id");
        dragEl = cont.querySelector(`.cat-btn--add[data-cat-id="${id}"]`) || pressTarget;
        dragEl?.classList.add("dragging");
        if (navigator.vibrate) navigator.vibrate(30);
    };

    const onPressStart = (x, y, target) => {
        if (!target || target.classList.contains("cat-btn--ghost")) return;
        resetScroll();
        pressTarget = target;
        startX = x;
        startY = y;
        lastScrollY = y;
        clearTimeout(pressTimer);
        pressTimer = setTimeout(window.catEditMode ? beginDragHold : beginLongPress, LONG_MS);
    };

    const handleMove = (x, y, prevent) => {
        if (scrollMode) {
            cont.scrollTop -= (y - lastScrollY);
            lastScrollY = y;
            return true;
        }
        if (pressTimer && !dragEl) {
            const dx = Math.abs(x - startX), dy = Math.abs(y - startY);
            if (window.catEditMode && dy > MOVE_PX && dy > dx * 1.1) {
                clearPress();
                scrollMode = true;
                lastScrollY = y;
                return true;
            }
            if (!window.catEditMode && movedTooFar(x, y)) {
                clearPress();
                return false;
            }
        }
        if (!dragEl) return false;
        prevent();
        const elemBelow = document.elementFromPoint(x, y);
        const dropTarget = elemBelow ? elemBelow.closest(".cat-btn--add[data-cat-id]") : null;
        const grid = dragEl.parentElement;
        if (dropTarget && dropTarget !== dragEl && grid) {
            const rect = dropTarget.getBoundingClientRect();
            const next = (y - rect.top) / (rect.bottom - rect.top) > 0.5;
            grid.insertBefore(dragEl, next ? dropTarget.nextSibling : dropTarget);
        }
        return true;
    };

    zone.addEventListener("touchstart", e => {
        if (e.target.closest(".cat-btn__hide") || e.target.closest(".add-cats-done")) return;
        if (e.target.closest(".back-link") && !e.target.closest(".add-cats-done")) return;
        const target = e.target.closest(".cat-btn--add[data-cat-id]");
        if (!target) return;
        const t = e.touches[0];
        onPressStart(t.clientX, t.clientY, target);
    }, { passive: true });

    zone.addEventListener("pointerdown", e => {
        if (e.pointerType !== "mouse" || e.button !== 0) return;
        if (e.target.closest(".cat-btn__hide") || e.target.closest(".add-cats-done")) return;
        const target = e.target.closest(".cat-btn--add[data-cat-id]");
        if (!target) return;
        onPressStart(e.clientX, e.clientY, target);
    });

    zone.addEventListener("touchmove", e => {
        const touch = e.touches[0];
        if (handleMove(touch.clientX, touch.clientY, () => e.preventDefault())) {
            if (scrollMode || dragEl) e.preventDefault();
        }
    }, { passive: false });

    zone.addEventListener("pointermove", e => {
        if (e.pointerType !== "mouse") return;
        handleMove(e.clientX, e.clientY, () => e.preventDefault());
    });

    const onPressEnd = () => {
        setTimeout(() => { window._blockCatTap = false; }, 200);
        endDrag();
    };

    zone.addEventListener("touchend", onPressEnd);
    zone.addEventListener("touchcancel", onPressEnd);
    zone.addEventListener("pointerup", e => {
        if (e.pointerType !== "mouse") return;
        onPressEnd();
    });
    zone.addEventListener("pointercancel", e => {
        if (e.pointerType !== "mouse") return;
        onPressEnd();
    });

    zone.addEventListener("click", e => {
        if (e.target.closest(".cat-btn__hide") || e.target.closest(".add-cats-done")) return;
        if (e.target.closest(".cat-btn--masked")) return;
        if (window._blockCatTap) {
            e.preventDefault();
            e.stopPropagation();
        }
    }, true);

    document.addEventListener("touchstart", e => {
        if (!window.catEditMode) return;
        if (e.target.closest("#add-cats-zone") || e.target.closest(".add-cats-done")) return;
        if (e.target.closest("#tab-add")) window.exitCatEditMode(true);
    }, { passive: true });
};

window.syncDescDisplay = () => {
    const el = window.el("add-desc");
    if (!el) return;
    if (window.descStr) {
        el.innerHTML = `<span class="add-desc-val">${window.descStr.replace(/</g, "&lt;")}</span>`;
        el.classList.add("has-text");
    } else {
        el.innerHTML = `<span class="add-desc-ph">${window.t ? window.t("desc_ph") : "Izoh (ixtiyoriy)..."}</span>`;
        el.classList.remove("has-text");
    }
};

window.syncAddLayout = function() {
    requestAnimationFrame(() => {
        const stack = window.el("add-bottom-stack");
        if (!stack) return;
        const tab = window.el("tab-add");
        if (tab && tab.classList.contains("hidden")) return;
        const h = Math.ceil(stack.getBoundingClientRect().height);
        if (h > 0) document.documentElement.style.setProperty("--add-bottom-stack-h", h + "px");
    });
};

window.focusAddAmount = () => {
    window.keypadMode = "amount";
    const n = window.el("add-kb-amount"), t = window.el("add-kb-text");
    if (n) n.classList.remove("hidden");
    if (t) t.classList.add("hidden");
    const d = window.el("add-desc"), nd = window.el("num-display");
    if (d) d.classList.remove("add-desc--active");
    if (nd) nd.classList.add("num-display--active");
    window.syncAddLayout();
};

window.focusAddDesc = () => {
    window.keypadMode = "text";
    const n = window.el("add-kb-amount"), t = window.el("add-kb-text");
    if (n) n.classList.add("hidden");
    if (t) t.classList.remove("hidden");
    const d = window.el("add-desc"), nd = window.el("num-display");
    if (d) d.classList.add("add-desc--active");
    if (nd) nd.classList.remove("num-display--active");
    window.syncAddLayout();
};

window.pressTextKey = k => {
    if (k === "⌫") window.descStr = window.descStr.slice(0, -1);
    else if (k === "123") { window.focusAddAmount(); return; }
    else if (k === "CLR") window.descStr = "";
    else if (window.descStr.length < 120) window.descStr += k;
    window.syncDescDisplay();
};

window.initAddKeyboard = () => {
    const panel = window.el("add-kb-text");
    if (!panel || panel.dataset.init === "2") return;
    panel.dataset.init = "2";
    const rows = [
        ["Q","W","E","R","T","Y","U","I","O","P"],
        ["A","S","D","F","G","H","J","K","L"],
        ["Z","X","C","V","B","N","M","O'","G'"]
    ];
    let html = '<div class="text-kb-grid text-kb-grid--add">';
    rows.forEach(row => {
        html += '<div class="text-kb-row">';
        row.forEach(k => {
            const esc = k.replace(/'/g, "\\'");
            html += `<button type="button" class="text-kb-key" onclick="window.pressTextKey('${esc}')">${k}</button>`;
        });
        html += "</div>";
    });
    html += `<div class="text-kb-row text-kb-row--bottom">
        <button type="button" class="text-kb-key" onclick="window.pressTextKey(',')">,</button>
        <button type="button" class="text-kb-key" onclick="window.pressTextKey('.')">.</button>
        <button type="button" class="text-kb-key text-kb-key--wide" onclick="window.pressTextKey(' ')">␣</button>
        <button type="button" class="text-kb-key" onclick="window.pressTextKey('⌫')">⌫</button>
        <button type="button" class="text-kb-key text-kb-key--mode" onclick="window.focusAddAmount()">123</button>
    </div></div>`;
    panel.innerHTML = html;
    window.syncAddLayout();
};

window.pressNum = v => {
    if (window.keypadMode === "text") { window.focusAddAmount(); }
    if (v==="C") window.amtStr=""; else if(v==="⌫") window.amtStr=window.amtStr.slice(0,-1); else if(window.amtStr.length<12) window.amtStr+=v;
    let displayVal = "0"; if (window.amtStr) displayVal = parseInt(window.amtStr).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    window.setTxt("num-display", displayVal);
    window.focusAddAmount();
};

window.getCats = function() { return window.getCatsForProfile ? window.getCatsForProfile() : (window.CATS_DATA.general || []); };

window.renderAddCats = function() {
    const cont = window.el("cats-container"), head = window.el("cats-header-container"), zone = window.el("add-cats-zone");
    if(!cont || !head) return;
    const level = window.getAddCatLevel();
    cont.className = `cats-level--${level}`;
    zone?.classList.toggle("cats-zone--edit", !!window.catEditMode);

    const parentForLevel = () => {
        if (window.actSubCat) return window.actSubCat.id;
        if (window.actMainCat) return window.actMainCat.id;
        if (window.addMode === "income") return "income";
        return null;
    };
    const parentId = parentForLevel();

    const mkBtn = (item, onclick, extraCls = "") => {
        const id = item.id || "";
        const hidden = window.isCatHidden(id, level, parentId);
        const maskedCls = hidden ? " cat-btn--masked" : "";
        const wiggleCls = window.catEditMode && !hidden && !extraCls.includes("ghost") ? " cat-btn--wiggle" : "";
        const editCls = window.catEditMode ? " cat-btn--edit" : "";
        const hideBtn = window.catEditMode && id && id !== "umumiy"
            ? `<span class="cat-btn__hide${hidden ? " cat-btn__hide--restore" : ""}" onclick="window.onHideCatClick(event,'${id}','${level}','${parentId || "root"}')">${hidden ? "↩" : "×"}</span>`
            : "";
        let action = "";
        if (!window.catEditMode) action = ` onclick="${onclick}"`;
        else if (hidden) action = ` onclick="window.onRestoreCatClick(event,'${id}','${level}','${parentId || "root"}')"`;
        return `<button type="button" class="cat-btn cat-btn--add${extraCls ? " " + extraCls : ""}${maskedCls}${wiggleCls}${editCls}" data-cat-id="${id}"${action}>${hideBtn}<span class="cat-btn__icon">${item.icon}</span><span class="cat-btn__label">${item.label}</span></button>`;
    };
    const wrap = (html, pId) => `<div class="cat-scroll--add cat-grid--${level}" data-level="${level}" data-parent="${pId || "root"}">${html}</div>`;

    const editHead = `<div class="add-crumb add-crumb--edit"><span>↕️ ${window.t("sort_mode")}</span><button type="button" class="back-link add-cats-done" onclick="window.exitCatEditMode()">${window.t("ready")}</button></div>`;

    if (window.addMode === "income") {
        head.innerHTML = window.catEditMode ? editHead : `<div class="add-cats-hint">${window.t("sort_hint")}</div>`;
        const src = window.filterCatItems(window.INC_SOURCES.map((s, i) => ({ ...s, id: "inc_" + i })), "main", "income");
        cont.innerHTML = wrap(src.map(s => mkBtn(s, `saveTx('${s.label.replace(/'/g, "\\'")}')`)).join(""), "income");
        window.syncAddLayout();
        return;
    }

    const cats = window.filterCatItems(window.getCats(), "main", null);
    if (window.actSubCat) {
        head.innerHTML = window.catEditMode ? editHead : `<div class="add-crumb"><span>${window.actMainCat.label} <b>›</b> ${window.actSubCat.label}</span><button type="button" class="back-link" onclick="backCat()">${window.t("back")}</button></div>`;
        const items = window.filterCatItems(window.actSubCat.items, "items", window.actSubCat.id);
        cont.innerHTML = wrap(items.map(i => mkBtn(i, `saveTx('${i.label.replace(/'/g, "\\'")}', true)`, "cat-btn--pick")).join(""), window.actSubCat.id);
    } else if (window.actMainCat && window.actMainCat.subs && window.actMainCat.subs.length > 0) {
        head.innerHTML = window.catEditMode ? editHead : `<div class="add-crumb"><span>${window.t("rukun")} <b>${window.actMainCat.label}</b></span><button type="button" class="back-link" onclick="backCat()">${window.t("back")}</button></div>`;
        let subs = window.filterCatItems(window.actMainCat.subs, "rukun", window.actMainCat.id);
        let html = subs.map(s => {
            const f = s.items?.length > 0;
            const lbl = s.label + (f ? "" : " ✓");
            return mkBtn({ ...s, label: lbl }, f ? `clickSubCat('${s.id}')` : `saveTx('${s.label.replace(/'/g, "\\'")}')`);
        }).join("");
        if (!window.catEditMode || !window.isCatHidden("umumiy", "rukun", window.actMainCat.id)) {
            html += mkBtn({ id: "umumiy", icon: "⚙️", label: "Umumiy" }, `saveTx('${window.actMainCat.label.replace(/'/g, "\\'")}')`, "cat-btn--ghost");
        }
        cont.innerHTML = wrap(html, window.actMainCat.id);
    } else {
        head.innerHTML = window.catEditMode ? editHead : `<div class="add-cats-hint">${window.t("sort_hint")}</div>`;
        cont.innerHTML = wrap(cats.map(c => mkBtn(c, `clickMainCat('${c.id}')`, "cat-btn--main")).join(""), null);
    }
    window.syncAddLayout();
};

window.clickMainCat = id => {
    if (window.catEditMode) return;
    const c = window.getCats().find(x=>x.id==id);
    if(c && c.subs?.length) { window.actMainCat = c; window.renderAddCats(); window.setHtml("stay-hint",""); }
    else if(c) window.saveTx(c.label);
};
window.clickSubCat = id => {
    if (window.catEditMode) return;
    const s = window.actMainCat.subs.find(x=>x.id==id);
    if(s && s.items?.length) { window.actSubCat = s; window.renderAddCats(); window.setHtml("stay-hint",""); }
    else if(s) window.saveTx(s.label);
};
window.backCat = () => {
    window.exitCatEditMode(true);
    if(window.actSubCat) window.actSubCat = null;
    else window.actMainCat = null;
    window.setHtml("stay-hint","");
    window.renderAddCats();
};

window.saveTx = (l, isDeepItem=false) => {
    const a = parseFloat(window.amtStr); if(!a || a<=0) return window.toast("Summa yo'q!", true); const d = new Date();
    let realCat = window.actMainCat ? window.actMainCat.label : l, realSubCat = l;
    if(isDeepItem && window.actSubCat) realSubCat = `${window.actSubCat.label} › ${l}`; else if(window.actMainCat) realSubCat = l;

    const note = (window.descStr || "").trim();
    const i = { id: Date.now(), amount: a, desc: note || l, cat: realCat, subCat: realSubCat, date: d.toISOString().slice(0,10), time: d.toLocaleTimeString("uz-UZ",{hour:'2-digit',minute:'2-digit'}), user: window.tgUser, prof: window.curProf };
    if(window.addMode==="expense") {
        const lim = window.getLimitStatus(window.curProf);
        if (lim.level === "danger") return window.toast("Oylik limit tugagan!", true);
        window.state.txs.unshift(i);
    } else window.state.incs.unshift(i);
    if (window.creditIncomeToReserve) window.creditIncomeToReserve(a, note || l);
    window.logAudit(window.addMode === 'expense' ? 'expense' : 'income', i.desc, { amount: a, cat: realCat });
    window.sessionData.push({ amount: a, category: `${i.desc} [${window.tgUser}]`, type: window.addMode==='expense'?'minus':'plus' });
    const sc = document.getElementById('session-count');
    if (sc) sc.innerText = String(window.sessionData.length);
    window.amtStr = ""; window.descStr = ""; window.setTxt("num-display", "0");
    if (window.syncDescDisplay) window.syncDescDisplay();
    if (window.focusAddAmount) window.focusAddAmount();
    window.save(); 
    if(window.actSubCat||window.actMainCat) { window.setHtml("stay-hint", `✅ Oxirgi: <b style="color:var(--success);">${window.formatM(a)}</b>. Yana kiriting!`); window.renderAddCats(); } else window.setHtml("stay-hint", ""); 
    if (window.headerTodayOpen) window.renderHeaderTodayPanel();
    window.updateHeaderBalance();
    window.toast("Saqlandi!");
};

window.renderReport = function() {
    let f = window.val("rep-from"), t = window.val("rep-to"); if(!f||!t) { const d = new Date().toISOString().slice(0,10); f=d; t=d; }
    const fTxs = window.state.txs.filter(x => x.date>=f && x.date<=t && (x.prof===window.curProf || window.curProf=='general'));
    const fIncs = window.state.incs.filter(x => x.date>=f && x.date<=t && (x.prof===window.curProf || window.curProf=='general'));
    const pInc = fIncs.reduce((s,i)=>s+i.amount, 0), pExp = fTxs.reduce((s,x)=>s+x.amount, 0);
    window.setTxt("rep-inc-val", window.formatM(pInc)); window.setTxt("rep-exp-val", window.formatM(pExp));

    let uExp = {}; fTxs.forEach(x => { const u = x.user||"Siz"; uExp[u] = (uExp[u]||0)+x.amount; });
    window.setHtml("user-stats-container", Object.entries(uExp).map(([u,a]) => `<div style="background:var(--bg-card); padding:10px 15px; border-radius:12px; border:1px solid var(--border-color); min-width:100px; text-align:center;"><div style="font-size:12px; color:var(--text-muted);">${u}</div><div style="font-weight:bold; font-size:15px; margin-top:4px;">${window.formatM(a).replace(" so'm","")}</div></div>`).join("") || "<div style='color:var(--text-muted); font-size:13px;'>Ma'lumot yo'q</div>");

    let cats = {}; fTxs.forEach(x => { cats[x.cat] = (cats[x.cat]||0)+x.amount; });
    window.setHtml("rep-cats-list", Object.entries(cats).map(([c,a]) => { const p = Math.round((a/pExp)*100); return `<div style="background:var(--bg-card); padding:12px; border-radius:12px; margin-bottom:8px;"><div style="display:flex; justify-content:space-between; font-weight:bold; font-size:13px; margin-bottom:6px;"><span>${c} (${p}%)</span><span>${window.formatM(a)}</span></div><div style="background:rgba(255,255,255,0.05); border-radius:4px; height:6px;"><div style="height:100%; border-radius:4px; width:${p}%; background:var(--primary);"></div></div></div>`; }).join("") || "<div style='text-align:center; color:var(--text-muted); font-size:13px;'>Xarajat yo'q.</div>");

    const cb = [...fIncs.map(i=>({...i,m:'plus'})), ...fTxs.map(x=>({...x,m:'minus'}))].sort((a,b)=>b.id-a.id);
    window.setHtml("rep-history-list", cb.map(i => `<div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--border-color); font-size:13px;"><div><div style="font-weight:bold; color:${i.m==='plus'?'var(--success)':'#fff'};">${i.desc}</div><div style="font-size:11px; color:var(--text-muted); margin-top:4px;">👤 ${i.user||'Siz'} | 📅 ${i.date}</div></div><div style="display:flex; align-items:center; gap:10px;"><span style="font-weight:bold; color:${i.m==='plus'?'var(--success)':'var(--danger)'};">${i.m==='plus'?'+':'-'}${window.formatM(i.amount).replace(" so'm","")}</span> <button class="delete-btn" onclick="delItem('${i.m==='minus'?'tx':'inc'}', ${i.id})">✕</button></div></div>`).join("") || "<div style='text-align:center; color:var(--text-muted); font-size:13px;'>Tarix bo'sh.</div>");
};

window.delItem = function(type, id) {
    if (type === 'tx') window.state.txs = window.state.txs.filter(x => x.id !== id);
    else window.state.incs = window.state.incs.filter(x => x.id !== id);
    window.save(true);
    if (window.renderReport) window.renderReport();
    if (window.headerTodayOpen) window.renderHeaderTodayPanel();
    window.updateHeaderBalance();
    window.toast("O'chirildi");
};

window.downloadExcel = () => { let c="\uFEFFSana,Profil,Turi,Odam,Rukun,Kategoriya,Izoh,Summa\n"; [...window.state.incs.map(i=>({...i,t:"Kirim"})), ...window.state.txs.map(t=>({...t,t:"Chiqim"}))].sort((a,b)=>b.id-a.id).forEach(r => { const p = window.state.profiles.find(x=>x.id==r.prof)?.name||'Umumiy'; c+=`${r.date},${p},${r.t},${r.user||'Siz'},${r.cat||''},${r.subCat||''},${r.desc},${r.amount}\n`; }); const b=new Blob([c], {type:'text/csv;charset=utf-8;'}); const l=document.createElement("a"); l.setAttribute("href", URL.createObjectURL(b)); l.setAttribute("download", "Hisobot.csv"); document.body.appendChild(l); l.click(); };

window.getProfileBalance = function(profId) {
    const p = profId || window.curProf;
    const match = x => p === "general" || x.prof === p;
    const inc = window.state.incs.filter(match).reduce((s, i) => s + i.amount, 0);
    const exp = window.state.txs.filter(match).reduce((s, t) => s + t.amount, 0);
    return inc - exp;
};

window.updateHeaderBalance = function() {
    const balEl = window.el("header-balance");
    if (balEl) {
        const bal = window.getWalletBalance
            ? window.getWalletBalance(window.curProf)
            : window.getProfileBalance();
        balEl.textContent = window.formatM(bal);
        balEl.style.color = bal >= 0 ? "var(--primary)" : "var(--danger)";
    }
    const expEl = window.el("header-today-exp");
    if (expEl) {
        const todayExp = window.getTodayExpense();
        expEl.textContent = window.formatM(todayExp).replace(" so'm", "");
    }
    window.updateHeaderNotifications();
};

window.render = function() {
    if (window.renderHomeTab) window.renderHomeTab();
    else {
        const tInc = window.state.incs.reduce((s,i)=>s+i.amount, 0), tExp = window.state.txs.reduce((s,t)=>s+t.amount, 0);
        window.setTxt("main-total-balance", window.formatM(tInc - tExp));
    }
    window.updateHeaderBalance();

    const d = new Date(), tM = d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,'0');
    let sHtml = ""; 
    window.state.sched.filter(s => !s.archived && (s.prof === window.curProf || window.curProf === "general")).forEach(s => {
        const getWD = (y,m) => { let d=new Date(y,m,0).getDate(), w=0; for(let i=1;i<=d;i++) { let day=new Date(y,m-1,i).getDay(); if(day!==0&&day!==6) w++; } return w; };
        const actAmt = s.miss > 0 ? Math.max(0, Math.round(s.amt - ((s.amt / getWD(parseInt(s.tMonth.split('-')[0]), parseInt(s.tMonth.split('-')[1]))) * s.miss))) : s.amt;
        const sm = parseInt(s.tMonth.replace("-","")), cm = parseInt(tM.replace("-","")); let isDue = false, st = "";
        if(sm < cm) { isDue = true; st = "O'tib ketgan!"; } else if(sm === cm) { if(d.getDate() >= s.day) { isDue = true; st = "Vaqti keldi!"; } else if(s.day - d.getDate() <= 3) { isDue = true; st = `${s.day - d.getDate()} kun qoldi`; } }
        if(isDue) sHtml += `<div class="plan-item"><div style="flex:1;"><span>⚠️ <b style="font-size:14px;">${s.label}</b> <span style="font-size:11px; color:var(--danger);">(${st})</span></span><div style="font-size:11px; color:var(--text-muted); margin-top:4px;">Qoldirilgan kun: <input type="number" onchange="updMiss(${s.id}, this.value)" value="${s.miss||''}" style="width:40px; padding:2px; background:var(--bg-dark); color:#fff; border:1px solid var(--border-color); text-align:center;"></div></div><div style="text-align:right;"><div style="font-weight:bold; font-size:14px; color:#fff;">${window.formatM(actAmt)}</div><button onclick="paySched(${s.id})" class="btn-primary btn-success" style="width:auto; padding:6px 10px; font-size:11px; margin-top:4px; margin-bottom:0;">To'lash</button></div></div>`;
    }); 
    window.setHtml("sched-list-container", sHtml || "<div style='text-align:center; color:var(--text-muted); font-size:13px; padding:10px;'>Majburiy to'lovlar yo'q.</div>"); 
    if(window.renderSchedSet) window.renderSchedSet();

    if (window.curTab === "home" && window.renderHomeTab) window.renderHomeTab();
    if(window.curTab === "add") window.renderAddCats();
    if (window.headerTodayOpen) window.renderHeaderTodayPanel();
    if (window.headerNotifOpen) window.renderHeaderNotifPanel();
    
    if(window.curTab === "other") {
        const todayStr = new Date().toISOString().slice(0,10); const today = new Date();
        
        let activeDebts = window.state.debts.filter(x=>!x.archived);
        let hDebts = activeDebts.map(x => `<div class="list-item" style="border-left: 5px solid ${x.type=='take'?'var(--success)':'var(--danger)'}; flex-direction:column; align-items:flex-start;"><div style="display:flex; justify-content:space-between; width:100%; margin-bottom:6px;"><div><div style="font-size:15px; font-weight:bold;">${x.name}</div><div style="font-size:11px; color:var(--text-muted);">${x.type=='take'?'Olaman':'Beraman'}</div></div><div style="font-weight:bold; font-size:15px;">${window.formatM(x.amount)}</div></div><button onclick="closeDebt(${x.id})" class="btn-primary btn-success" style="padding:10px; font-size:13px; margin-bottom:0;">✅ Qarz uzildi</button></div>`).join("");
        window.setHtml("debts-list", hDebts || "<div style='text-align:center; color:var(--text-muted); font-size:13px;'>Qarzlar yo'q.</div>");

        let activeDeps = window.state.deps.filter(x=>!x.archived), archDeps = window.state.deps.filter(x=>x.archived);
        let hDepsAct = activeDeps.map(dep => `<div class="list-item" style="border-left: 5px solid var(--success); flex-direction:column; align-items:flex-start;"><div style="display:flex; justify-content:space-between; width:100%; margin-bottom:10px;"><div><div style="font-size:15px; font-weight:bold; color:var(--success);">${dep.bankIcon||'🏦'} ${dep.name}</div></div><div style="text-align:right;"><div style="font-weight:bold; font-size:16px;">${window.formatM(dep.amount)}</div></div></div><div style="display:flex; gap:6px; width:100%;"><button onclick="openTopupModal(${dep.id})" class="btn-primary" style="flex:1; background:transparent; border:1px solid var(--primary); color:var(--primary); padding:8px 2px; font-size:11px; margin-bottom:0;">+ Qo'sh</button><button onclick="openIntModal(${dep.id})" class="btn-primary" style="flex:1; background:transparent; border:1px solid var(--success); color:var(--success); padding:8px 2px; font-size:11px; margin-bottom:0;">💸 Foiz</button><button onclick="openDepScheduleModal(${dep.id})" class="btn-primary" style="flex:1; background:transparent; border:1px solid var(--warning); color:var(--warning); padding:8px 2px; font-size:11px; margin-bottom:0;">📊 Grafik</button></div><button onclick="closeDep(${dep.id})" class="btn-primary" style="width:100%; background:var(--danger); margin-top:8px; padding:10px; font-size:13px; margin-bottom:0;">Omonatni Yopish</button></div>`).join("");
        let hDepsArch = archDeps.map(dep => `<div class="list-item" style="border-left: 5px solid var(--text-muted); flex-direction:column; align-items:flex-start; filter: grayscale(100%);"><div style="display:flex; justify-content:space-between; width:100%;"><div><div style="font-size:15px; font-weight:bold; color:var(--text-muted); text-decoration:line-through;">${dep.bankIcon||'🏦'} ${dep.name}</div></div><div style="text-align:right;"><div style="font-weight:bold; font-size:16px; color:var(--text-muted);">${window.formatM(dep.amount)}</div></div></div><button onclick="permDelDep(${dep.id})" class="btn-primary" style="background:transparent; border:1px solid var(--danger); color:var(--danger); padding:8px; font-size:12px; margin-top:10px; width:100%; margin-bottom:0;">🗑️ O'chirish</button></div>`).join("");
        window.setHtml("deposits-list-active", hDepsAct || "<div style='text-align:center; color:var(--text-muted); font-size:13px; margin-top:20px;'>Aktiv omonatlar yo'q.</div>");
        window.setHtml("deposits-list-archived", hDepsArch || "<div style='text-align:center; color:var(--text-muted); font-size:13px; margin-top:20px;'>Arxivlangan omonatlar yo'q.</div>");

        let activeCredits = window.state.credits.filter(x=>!x.archived), archCredits = window.state.credits.filter(x=>x.archived);
        let hCredits = activeCredits.map(cr => {
            let overdue = false; let nextUnpaid = cr.schedule.find(x => x.status === 'unpaid');
            if (nextUnpaid && nextUnpaid.date < todayStr) overdue = true;
            let borderCol = overdue ? "var(--danger)" : "#ec4899"; let bgCol = overdue ? "rgba(239, 68, 68, 0.1)" : "var(--bg-card)";
            let currentBal = cr.initAmt - cr.schedule.filter(x => x.status === 'paid').reduce((s, x) => s + x.principal, 0) - (cr.extraPrincipalPaid || 0);
            return `<div class="list-item" style="border-left: 5px solid ${borderCol}; background:${bgCol}; flex-direction:column; align-items:flex-start;"><div style="display:flex; justify-content:space-between; width:100%; margin-bottom:10px;"><div><div style="font-size:15px; font-weight:bold; color:${borderCol};">${cr.bankIcon||'🏦'} ${cr.name}</div><div style="font-size:11px; color:var(--text-muted); margin-top:4px;">${cr.rate}%</div>${overdue?`<div style="font-size:10px; color:var(--danger); font-weight:bold; margin-top:4px;">⚠️ Muddat o'tgan!</div>`:''}</div><div style="text-align:right;"><div style="font-weight:bold; font-size:16px; color:${borderCol};">${window.formatM(currentBal)}</div></div></div><div style="display:flex; gap:6px; width:100%;"><button onclick="payNextMonthCredit(${cr.id})" class="btn-primary" style="flex:1; background:transparent; border:1px solid var(--success); color:var(--success); padding:8px 4px; font-size:11px; margin-bottom:0;">💸 Oylik</button><button onclick="openPrincipalPayModal(${cr.id})" class="btn-primary" style="flex:1; background:transparent; border:1px solid var(--warning); color:var(--warning); padding:8px 4px; font-size:11px; margin-bottom:0;">📉 Tanidan</button><button onclick="openCreditScheduleModal(${cr.id})" class="btn-primary" style="flex:1; background:transparent; border:1px solid var(--primary); color:var(--primary); padding:8px 4px; font-size:11px; margin-bottom:0;">📊 Grafik</button></div><button onclick="closeCredit(${cr.id})" class="btn-primary" style="width:100%; background:var(--danger); margin-top:8px; padding:10px; font-size:13px; margin-bottom:0;">Kreditni Yopish (To'liq)</button></div>`;
        }).join("");
        let archHtmlCredits = archCredits.map(cr => `<div class="list-item" style="border-left: 5px solid var(--text-muted); flex-direction:column; align-items:flex-start; filter: grayscale(100%);"><div style="display:flex; justify-content:space-between; width:100%;"><div><div style="font-size:15px; font-weight:bold; color:var(--text-muted); text-decoration:line-through;">${cr.bankIcon||'🏦'} ${cr.name}</div></div><div style="text-align:right;"><div style="font-weight:bold; font-size:16px; color:var(--text-muted);">${window.formatM(cr.initAmt)}</div></div></div><button onclick="permDelCredit(${cr.id})" class="btn-primary" style="background:transparent; border:1px solid var(--danger); color:var(--danger); padding:8px; font-size:12px; margin-top:10px; width:100%; margin-bottom:0;">🗑️ Butunlay o'chirish</button></div>`).join("");
        
        window.setHtml("credits-list-active", hCredits || "<div style='text-align:center; color:var(--text-muted); font-size:13px; margin-top:20px;'>Aktiv kreditlar yo'q.</div>");
        window.setHtml("credits-list-archived", archHtmlCredits || "<div style='text-align:center; color:var(--text-muted); font-size:13px; margin-top:20px;'>Arxivlangan kreditlar yo'q.</div>");
        
        if(window.el('bank-sub-plan') && !window.el('bank-sub-plan').classList.contains('hidden')) window.renderPlanned();
    }
    if(window.curTab === "report") window.renderReport();
};

// ==========================================
// BOOTSTRAP VA AVTO-SINXRONIZATSIYA
// ==========================================
window.startAutoSync = function() {
    if (!window.currentBudgetId) return;
    if (window._autoSyncTimer) clearInterval(window._autoSyncTimer);
    const tick = async () => {
        try {
            const cloudState = await window.fetchCloudState();
            if (!cloudState) return;
            const cloudDataStr = JSON.stringify(cloudState);
            const localDataStr = JSON.stringify(window.state);
            if (cloudDataStr !== localDataStr) {
                const prevIds = new Set((window.state.txs || []).map(t => t.id));
                window.applyCloudState(cloudState);
                const me = window.tgUser;
                const fresh = (window.state.txs || []).filter(t => !prevIds.has(t.id) && (t.user || "Siz") !== me);
                if (typeof window.render === "function") window.render();
                window.normalizeAllProfiles();
                if (typeof window.renderSidebar === "function") window.renderSidebar();
                if (typeof window.updatePlanCats === "function") window.updatePlanCats();
                if (typeof window.applyModulePermissions === "function") window.applyModulePermissions();
                if (fresh.length) {
                    window.updateHeaderNotifications();
                    const t = fresh[0];
                    window.toast(`🔔 ${t.user || "A'zo"}: ${window.formatM(t.amount)} — ${t.desc || t.cat || ""}`);
                }
            }
        } catch (e) {}
    };
    window._autoSyncTimer = setInterval(tick, 3000);
    window._autoSyncFastTimer = setInterval(() => {
        if (window._chatProfId && window.syncOpenChatFromCloud) window.syncOpenChatFromCloud();
    }, 1200);
};

if(document.readyState==="loading") {
    document.addEventListener("DOMContentLoaded", () => {
        window.initCloudData(); window.startAutoSync();
        window.addEventListener("resize", () => { if (window.syncAddLayout) window.syncAddLayout(); });
    });
} else {
    window.initCloudData(); window.startAutoSync();
    window.addEventListener("resize", () => { if (window.syncAddLayout) window.syncAddLayout(); });
}
