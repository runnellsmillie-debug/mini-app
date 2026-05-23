// ==========================================
// PROFILES.JS — Profil, PIN, limit, ruxsatlar
// ==========================================

window.PROTECTED_PROFILE_IDS = ["general", "home_profile"];

window.getProfileSortRank = function(p) {
    if (!p) return 99;
    if (String(p.id).startsWith("creator_")) return 0;
    if (p.id === "general") return 1;
    if (p.id === "home_profile") return 2;
    if (String(p.id).startsWith("user_") || p.role === "guest") return 3;
    return 4;
};

window.getSortedProfiles = function() {
    return (window.state.profiles || [])
        .filter(p => !p.archived)
        .sort((a, b) => {
            const r = window.getProfileSortRank(a) - window.getProfileSortRank(b);
            if (r !== 0) return r;
            return (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" });
        });
};

window.PIN_SESSION_KEY = "family_erp_unlocked";
window.TAB_PERMISSIONS = {
    tab_home: { tab: "home", label: "Asosiy", icon: "🏠" },
    tab_add: { tab: "add", label: "Kiritish", icon: "➕" },
    tab_other: { tab: "other", label: "Xizmatlar", icon: "💼" },
    tab_report: { tab: "report", label: "Hisobot", icon: "📊" }
};

window.PERMISSION_MODULES = {
    mod_plan: { menuId: "plan", label: "Bozorlik ro'yxati", icon: "🛒" },
    mod_sched: { menuId: "sched", label: "Rejali to'lovlar", icon: "📅" },
    view_credit: { menuId: "credit", label: "Kreditlar", icon: "💳" },
    view_dep: { menuId: "dep", label: "Omonatlar", icon: "🏦" },
    mod_debt: { menuId: "debt", label: "Qarzlar", icon: "🤝" },
    mod_income: { label: "Kirim kiritish", icon: "📈" }
};

window.SHOP_PERMISSIONS = {
    shop_food: { label: "Oziq-ovqat va Ro'zg'or", icon: "🥬" },
    shop_clothes: { label: "Kiyim va Shaxsiy", icon: "👕" },
    shop_school: { label: "Maktab / O'quv", icon: "📚" }
};

window.getAllPermissionGroups = function() {
    const tabs = Object.entries(window.TAB_PERMISSIONS).map(([id, t]) => ({
        id, icon: t.icon, label: t.label
    }));
    const services = Object.entries(window.PERMISSION_MODULES).map(([id, m]) => ({
        id, icon: m.icon || "📂", label: m.label
    }));
    const shops = Object.entries(window.SHOP_PERMISSIONS).map(([id, s]) => ({
        id, icon: s.icon, label: s.label
    }));
    return [
        { key: "tabs", label: window.t ? window.t("perm_tabs") : "Pastki menyu", items: tabs },
        { key: "services", label: window.t ? window.t("perm_services") : "Xizmatlar", items: services },
        { key: "shopping", label: window.t ? window.t("perm_shopping") : "Bozorlik toifalari", items: shops },
        { key: "admin", label: window.t ? window.t("perm_admin") : "Admin", items: [
            { id: "admin_all", icon: "👑", label: window.t ? window.t("perm_admin_all") : "Barcha huquqlar", danger: true }
        ]}
    ];
};

window.renderProfilePermsGrid = function(checkedIds) {
    const box = document.getElementById("fs-perms-container");
    if (!box) return;
    const checked = new Set(checkedIds || []);
    box.innerHTML = window.getAllPermissionGroups().map(group => `
        <div class="fs-perm-group">
            <div class="fs-perm-group__title">${group.label}</div>
            <div class="fs-perm-grid">
                ${group.items.map(item => `
                    <label class="perm-chip${item.danger ? " perm-chip--danger" : ""}${checked.has(item.id) ? " perm-chip--on" : ""}">
                        <input type="checkbox" class="fs-perm-chk" value="${item.id}"${checked.has(item.id) ? " checked" : ""}>
                        <span class="perm-chip__icon">${item.icon}</span>
                        <span class="perm-chip__lbl">${item.label}</span>
                    </label>
                `).join("")}
            </div>
        </div>
    `).join("");
    box.querySelectorAll(".fs-perm-chk").forEach(chk => {
        chk.addEventListener("change", () => {
            chk.closest(".perm-chip")?.classList.toggle("perm-chip--on", chk.checked);
        });
    });
};

window.DEFAULT_NEW_PROFILE_PERMS = [
    "tab_home", "tab_add", "tab_other", "tab_report",
    "shop_food", "shop_clothes", "shop_school",
    "mod_plan", "mod_sched", "view_credit", "view_dep", "mod_debt", "mod_income"
];

window.DEFAULT_PROFILES = [
    { id: "general", name: "Umumiy", icon: "🏠", role: "home", age: null, gender: "", monthlyLimit: 0, pinEnabled: true, pinHash: "", permissions: ["admin_all"], linked_phone: "", linked_uid: null },
    { id: "home_profile", name: "Uy/Ro'zg'or", icon: "🏡", role: "home", age: null, gender: "", monthlyLimit: 0, pinEnabled: true, pinHash: "", permissions: [], linked_phone: "", linked_uid: null }
];

window.normalizeProfile = function(p) {
    if (!p) return null;
    return {
        id: p.id,
        name: p.name || "Profil",
        icon: p.icon || "👤",
        role: p.role || "relative",
        age: p.age != null && p.age !== "" ? parseInt(p.age, 10) : null,
        gender: p.gender || (p.role && p.role.endsWith("_f") ? "f" : p.role && p.role.endsWith("_m") ? "m" : ""),
        monthlyLimit: parseInt(p.monthlyLimit, 10) || 0,
        pinEnabled: !!p.pinEnabled,
        pinHash: p.pinHash || "",
        permissions: window.normalizeProfilePermissions(p),
        permsConfigured: !!p.permsConfigured,
        linked_phone: p.linked_phone || "",
        linked_uid: p.linked_uid != null && p.linked_uid !== "" ? String(p.linked_uid) : null,
        archived: !!p.archived
    };
};

window.normalizeProfilePermissions = function(p) {
    let perms = Array.isArray(p?.permissions) ? [...p.permissions] : [];
    if (perms.includes("admin_all")) return perms;
    if (p?.permsConfigured) return perms;
    if (perms.length === 0) {
        const age = p?.age != null && p.age !== "" ? parseInt(p.age, 10) : null;
        const tabs = age != null && age < 16
            ? ["tab_home", "tab_add"]
            : ["tab_home", "tab_add", "tab_other", "tab_report"];
        tabs.forEach(t => { if (!perms.includes(t)) perms.push(t); });
    }
    return perms;
};

window.canAccessTab = function(tabId, prof) {
    const p = prof || window.getActiveProfile();
    if (!p) return tabId === "home";
    return window.hasPermission("tab_" + tabId, p);
};

window.getFirstAllowedTab = function(prof) {
    const order = ["home", "add", "other", "report"];
    for (const t of order) if (window.canAccessTab(t, prof)) return t;
    return "add";
};

window.findProfileByName = function(query) {
    const q = (query || "").trim().toLowerCase();
    if (!q) return null;
    const list = window.state.profiles.filter(p => !p.archived);
    return list.find(p => (p.name || "").toLowerCase() === q)
        || list.find(p => (p.name || "").toLowerCase().includes(q));
};

window.quickSelectProfileByName = function() {
    const inp = window.el("profile-quick-input") || window.el("add-prof-quick");
    const q = inp ? window.val(inp.id) : "";
    const p = window.findProfileByName(q);
    if (!p) return window.toast("Profil topilmadi", true);
    if (inp) window.setVal(inp.id, "");
    window.selectProfileSafe(p.id);
};

window.tryAutoLinkProfile = function() {
    if (!window.tgUserId) return;
    const uid = String(window.tgUserId);
    const linked = window.state.profiles.find(p => !p.archived && p.linked_uid && String(p.linked_uid) === uid);
    if (!linked || window.curProf === linked.id) return;
    window.requestProfileAccess(linked.id, () => {
        window.curProf = linked.id;
        const el = document.getElementById("current-profile-name");
        if (el) el.innerText = linked.name || "Profil";
        window.applyModulePermissions();
        if (window.checkAccess) window.checkAccess();
        if (window.renderSidebar) window.renderSidebar();
        if (window.renderAddProfileStrip) window.renderAddProfileStrip();
        if (window.render) window.render();
        window.toast(`${linked.name} profiliga ulandingiz`);
    });
};

window.normalizeAllProfiles = function() {
    if (!window.state.profiles || !window.state.profiles.length) {
        window.state.profiles = window.DEFAULT_PROFILES.map(p => ({ ...p, permissions: [...p.permissions] }));
    } else {
        window.state.profiles = window.state.profiles.filter(p => p && p.id).map(window.normalizeProfile);
    }
    if (!window.state.audit) window.state.audit = [];
};

window.ensureCreatorProfile = function() {
    if (!window.tgUserId) return;
    const cid = "creator_" + window.tgUserId;
    if (window.state.profiles.some(p => p.id === cid)) return;
    const name = (window.tgFirstName || window.tgUser || "Yaratuvchi").trim();
    window.state.profiles.push(window.normalizeProfile({
        id: cid,
        name: name,
        icon: "👑",
        role: "parent_m",
        age: null,
        gender: "m",
        monthlyLimit: 0,
        pinEnabled: false,
        pinHash: "",
        permissions: ["admin_all"],
        linked_phone: "",
        linked_uid: parseInt(window.tgUserId, 10)
    }));
    window.logAudit("profile_create", `Yaratuvchi profili: ${name}`);
};

window.isBudgetAdmin = function() {
    return window.isAdmin === true || window.isAdmin === "true";
};

window.getActiveProfile = function() {
    return window.state.profiles.find(x => x.id === window.curProf) || window.state.profiles[0];
};

window.hasPermission = function(perm, prof) {
    const p = prof || window.getActiveProfile();
    if (!p) return false;
    const perms = p.permissions || [];
    if (perms.includes("admin_all")) return true;
    return perms.includes(perm);
};

window.hashPin = function(pin) {
    const s = "1money_" + String(pin);
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) | 0;
    return "p" + Math.abs(h);
};

window.getUnlockedProfiles = function() {
    try { return JSON.parse(sessionStorage.getItem(window.PIN_SESSION_KEY) || "[]"); } catch (e) { return []; }
};

window.setProfileUnlocked = function(profId) {
    const u = window.getUnlockedProfiles();
    if (!u.includes(profId)) u.push(profId);
    sessionStorage.setItem(window.PIN_SESSION_KEY, JSON.stringify(u));
};

window.isProfileUnlocked = function(profId) {
    const p = window.state.profiles.find(x => x.id === profId);
    if (!p || !p.pinEnabled || !p.pinHash) return true;
    if (window.isBudgetAdmin()) return true;
    return window.getUnlockedProfiles().includes(profId);
};

window.needsPin = function(profId) {
    const p = window.state.profiles.find(x => x.id === profId);
    return !!(p && p.pinEnabled && p.pinHash && !window.isProfileUnlocked(profId));
};

window.showPinModal = function(profId, onSuccess) {
    window._pinTargetProf = profId;
    window._pinSuccessCb = onSuccess;
    window.setVal("pin-input", "");
    window.setTxt("pin-modal-title", window.state.profiles.find(x => x.id === profId)?.name || "Profil");
    if (window.el("modal-pin")) window.el("modal-pin").style.display = "flex";
};

window.closePinModal = function() {
    if (window.el("modal-pin")) window.el("modal-pin").style.display = "none";
    window._pinTargetProf = null;
    window._pinSuccessCb = null;
};

window.submitPin = function() {
    const pin = window.val("pin-input").replace(/\D/g, "");
    if (pin.length !== 4) return window.toast("4 xonali PIN kiriting", true);
    const p = window.state.profiles.find(x => x.id === window._pinTargetProf);
    if (!p || window.hashPin(pin) !== p.pinHash) return window.toast("PIN noto'g'ri", true);
    window.setProfileUnlocked(p.id);
    window.closePinModal();
    if (window._pinSuccessCb) window._pinSuccessCb();
};

window.requestProfileAccess = function(profId, onReady) {
    if (!window.needsPin(profId)) { if (onReady) onReady(); return; }
    window.showPinModal(profId, onReady);
};

window.getProfileMonthSpend = function(profId) {
    const d = new Date();
    const m = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    return (window.state.txs || []).filter(x => x.prof === profId && x.date && x.date.startsWith(m)).reduce((s, x) => s + (x.amount || 0), 0);
};

window.getLimitStatus = function(profId) {
    const p = window.state.profiles.find(x => x.id === profId);
    if (!p || !p.monthlyLimit || p.monthlyLimit <= 0) return { level: "none", pct: 0 };
    const spent = window.getProfileMonthSpend(profId);
    const pct = Math.round((spent / p.monthlyLimit) * 100);
    if (pct >= 100) return { level: "danger", pct, spent };
    if (pct >= 80) return { level: "warn", pct, spent };
    return { level: "ok", pct, spent };
};

window.logAudit = function(action, detail, extra) {
    if (!window.state.audit) window.state.audit = [];
    window.state.audit.unshift({
        id: Date.now(),
        ts: new Date().toISOString(),
        action,
        detail: detail || "",
        user: window.tgUser || "Siz",
        uid: window.tgUserId || "",
        prof: window.curProf,
        ...extra
    });
    if (window.state.audit.length > 200) window.state.audit.length = 200;
};

window.filterCatsByPermissions = function(cats, profile) {
    const p = profile || window.getActiveProfile();
    if (!p || window.hasPermission("admin_all", p)) return cats;
    const perms = p.permissions || [];
    const shopMap = {
        shop_food: ["oziq", "ozi", "ro'zg", "rozg", "uy", "xojalik", "sut", "non"],
        shop_clothes: ["kiyim", "shaxsiy", "kattalar"],
        shop_school: ["talim", "maktab", "kansel", "o'quv"]
    };
    const hasShop = perms.some(x => x.startsWith("shop_"));
    if (!hasShop) return cats;
    const filtered = cats.filter(c => {
        const label = (c.label || "").toLowerCase();
        const id = (c.id || "").toLowerCase();
        for (const [perm, keys] of Object.entries(shopMap)) {
            if (!perms.includes(perm)) continue;
            if (keys.some(k => label.includes(k) || id.includes(k.replace("'", "")))) return true;
        }
        return false;
    });
    return filtered.length ? filtered : cats;
};

window.sortCatsForAge = function(cats, age) {
    if (age == null || age > 6) return cats;
    const priority = ["oyin", "bolalar", "bog", "taglik", "talim", "kiyim", "oziq", "sut"];
    return [...cats].sort((a, b) => {
        const score = (item) => {
            const t = ((item.label || "") + (item.id || "")).toLowerCase();
            let s = 100;
            priority.forEach((k, i) => { if (t.includes(k)) s = Math.min(s, i); });
            return s;
        };
        return score(a) - score(b);
    });
};

window.getCatsForProfile = function() {
    const p = window.getActiveProfile();
    const roleKey = window.curProf === "home_profile" ? "home" : (p?.role || "general");
    let cats = [...(window.CATS_DATA[roleKey] || window.CATS_DATA.general || [])];
    cats = window.filterCatsByPermissions(cats, p);
    if (p && p.age != null) cats = window.sortCatsForAge(cats, p.age);
    return cats.length ? cats : (window.CATS_DATA.general || []);
};

window.applyModulePermissions = function() {
    const p = window.getActiveProfile();
    const show = (perm) => window.hasPermission(perm, p);

    ["home", "add", "other", "report"].forEach(tab => {
        const nav = window.el("nav-" + tab);
        if (nav) nav.style.display = window.canAccessTab(tab, p) ? "" : "none";
    });

    if (window.renderServicesMenu) window.renderServicesMenu();
    else {
        const menu = window.el("bank-main-menu");
        if (menu) {
            menu.querySelectorAll(".main-menu-btn").forEach(btn => {
                const id = btn.getAttribute("data-id");
                let ok = true;
                if (id === "plan") ok = show("mod_plan");
                else if (id === "sched") ok = show("mod_sched");
                else if (id === "credit") ok = show("view_credit");
                else if (id === "dep") ok = show("view_dep");
                else if (id === "debt") ok = show("mod_debt");
                btn.style.display = ok || show("admin_all") ? "" : "none";
            });
        }
    }

    const navOther = window.el("nav-other");
    if (navOther) navOther.style.display = window.canAccessTab("other", p) ? "" : "none";

    const child = p && p.age != null && p.age < 16 && !window.PROTECTED_PROFILE_IDS.includes(p.id);
    if (window.el("mode-inc")) window.el("mode-inc").style.display = (child || !show("mod_income")) && !show("admin_all") ? "none" : "";
    if (window.el("rep-inc-card")) window.el("rep-inc-card").style.display = (child || !show("mod_income")) && !show("admin_all") ? "none" : "";

    if (window.curTab && !window.canAccessTab(window.curTab, p) && window.switchTab) {
        window.switchTab(window.getFirstAllowedTab(p), true);
    }
    if (window.closeBankSubViewIfDenied) window.closeBankSubViewIfDenied();
    if (window.renderAddProfileStrip) window.renderAddProfileStrip();
};

window.initProfileRowPress = function(rowEl, profId) {
    if (!rowEl || rowEl._profPressInit) return;
    rowEl._profPressInit = true;
    const avatar = rowEl.querySelector(".profile-avatar");
    let timer = null;
    let longDone = false;

    const clearTimer = () => {
        if (timer) { clearTimeout(timer); timer = null; }
        avatar?.classList.remove("profile-avatar--hold");
    };

    rowEl.addEventListener("click", e => {
        if (longDone || e.defaultPrevented) return;
        window.selectProfileSafe(profId);
    });

    if (!avatar || !window.isBudgetAdmin()) return;

    let startX = 0, startY = 0;

    avatar.addEventListener("pointerdown", e => {
        e.stopPropagation();
        longDone = false;
        startX = e.clientX;
        startY = e.clientY;
        avatar.classList.add("profile-avatar--hold");
        clearTimer();
        timer = setTimeout(() => {
            timer = null;
            longDone = true;
            avatar.classList.remove("profile-avatar--hold");
            if (navigator.vibrate) navigator.vibrate(40);
            const sidebar = window.el("sidebar-menu");
            if (sidebar?.classList.contains("open")) window.toggleSidebar();
            window.openFullScreenModal(profId);
        }, 500);
    });

    avatar.addEventListener("pointermove", e => {
        if (!timer) return;
        if (Math.hypot(e.clientX - startX, e.clientY - startY) > 12) clearTimer();
    });

    avatar.addEventListener("pointerup", e => {
        if (longDone) {
            e.preventDefault();
            e.stopPropagation();
            longDone = false;
        }
        clearTimer();
    });

    avatar.addEventListener("pointercancel", clearTimer);
};

window.renderAddProfileStrip = function() {
    const strip = window.el("add-profile-strip");
    const sel = window.el("add-prof-switch");
    if (!strip || !sel) return;
    const show = window.canAccessTab("add");
    strip.style.display = show ? "" : "none";
    if (!show) return;
    const list = window.getSortedProfiles ? window.getSortedProfiles() : window.state.profiles.filter(p => !p.archived);
    sel.innerHTML = list.map(p =>
        `<option value="${p.id}"${p.id === window.curProf ? " selected" : ""}>${p.icon} ${p.name}</option>`
    ).join("");
};

window.toggleAccordion = function(id) {
    const content = document.getElementById(id);
    const icon = document.getElementById(id + "-icon");
    if (!content) return;
    const open = content.style.display === "flex";
    content.style.display = open ? "none" : "flex";
    if (icon) icon.innerText = open ? "▼" : "▲";
};
