// ==========================================
// PROFILES.JS — Profil, PIN, limit, ruxsatlar
// ==========================================

window.PROTECTED_PROFILE_IDS = ["general", "home_profile"];
window.PIN_SESSION_KEY = "family_erp_unlocked";
window.PERMISSION_MODULES = {
    mod_plan: { menuId: "plan", label: "Bozorlik" },
    mod_sched: { menuId: "sched", label: "Rejali to'lovlar" },
    mod_credit: { menuId: "credit", label: "Kreditlar", perm: "view_credit" },
    mod_dep: { menuId: "dep", label: "Omonatlar", perm: "view_dep" },
    mod_debt: { menuId: "debt", label: "Qarzlar" },
    mod_income: { label: "Kirim kiritish" },
    mod_report: { label: "Hisobot" }
};

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
        permissions: Array.isArray(p.permissions) ? p.permissions : [],
        linked_phone: p.linked_phone || "",
        linked_uid: p.linked_uid || null,
        archived: !!p.archived
    };
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
    if (window.isBudgetAdmin() && p.id === window.curProf) return true;
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
    const show = (perm) => window.hasPermission(perm, p) || window.hasPermission("admin_all", p);
    const menu = window.el("bank-main-menu");
    if (menu) {
        menu.querySelectorAll(".main-menu-btn").forEach(btn => {
            const id = btn.getAttribute("data-id");
            let ok = true;
            if (id === "plan") ok = show("mod_plan") || show("shop_food") || show("shop_clothes") || show("shop_school");
            else if (id === "sched") ok = show("mod_sched");
            else if (id === "credit") ok = show("mod_credit") || show("view_credit");
            else if (id === "dep") ok = show("mod_dep") || show("view_dep");
            else if (id === "debt") ok = show("mod_debt");
            btn.style.display = ok ? "" : "none";
        });
    }
    const navOther = document.querySelector('.nav-item[onclick*="other"]');
    const child = p && p.age != null && p.age < 16 && !window.PROTECTED_PROFILE_IDS.includes(p.id);
    if (navOther) navOther.style.display = child && !show("mod_plan") && !show("mod_sched") && !show("view_credit") && !show("view_dep") && !show("mod_debt") ? "none" : "";
    if (window.el("mode-inc")) window.el("mode-inc").style.display = (child || !show("mod_income")) ? "none" : "";
    if (window.el("rep-inc-card")) window.el("rep-inc-card").style.display = (child || !show("mod_income")) ? "none" : "";
};

window.toggleAccordion = function(id) {
    const content = document.getElementById(id);
    const icon = document.getElementById(id + "-icon");
    if (!content) return;
    const open = content.style.display === "flex";
    content.style.display = open ? "none" : "flex";
    if (icon) icon.innerText = open ? "▼" : "▲";
};
