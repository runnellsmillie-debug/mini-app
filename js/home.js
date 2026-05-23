// ==========================================
// HOME.JS — Asosiy: hamyonlar, hisob-kitob, chat
// ==========================================

window.ROLE_LABELS = {
    parent_m: "Ota",
    parent_f: "Ona",
    child_m: "O'g'il",
    child_f: "Qiz",
    relative: "Qarindosh",
    guest: "Mehmon",
    home: "Uy",
    spouse: "Turmush o'rtog'im"
};

window.ensureHomeState = function() {
    if (!window.state.wallets) window.state.wallets = {};
    if (!window.state.walletLedger) window.state.walletLedger = [];
    if (!window.state.chats) window.state.chats = {};
    if (window.state.wallets.general == null) {
        window.state.wallets.general = Math.max(0, window.getProfileBalance("general"));
    }
    (window.getSortedProfiles ? window.getSortedProfiles() : window.state.profiles).forEach(p => {
        if (p.archived || p.id === "general") return;
        if (window.state.wallets[p.id] == null) {
            window.state.wallets[p.id] = Math.max(0, window.getProfileBalance(p.id));
        }
    });
};

window.getProfilesWalletSum = function() {
    return window.getHomeBalanceRows().reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
};

window.getReserveBalance = function() {
    window.ensureHomeState();
    return parseFloat(window.state.wallets.general) || 0;
};

window.getGrandTotalBalance = function() {
    return window.getProfilesWalletSum() + window.getReserveBalance();
};

window.creditIncomeToReserve = function(amount, note) {
    amount = parseFloat(amount) || 0;
    if (amount <= 0) return;
    window.ensureHomeState();
    window.state.wallets.general = window.getWalletBalance("general") + amount;
    window.addWalletLedger({
        type: "income",
        fromProf: null,
        toProf: "general",
        amount,
        note: note || (window.t ? window.t("income_to_reserve") : "Kirim")
    });
};

window.getRelationLabel = function(p) {
    if (!p) return "";
    if (p.relationLabel) return p.relationLabel;
    return window.ROLE_LABELS[p.role] || window.t("relative");
};

window.getWalletBalance = function(profId) {
    window.ensureHomeState();
    if (window.state.wallets[profId] != null) return window.state.wallets[profId];
    return Math.max(0, window.getProfileBalance(profId));
};

window.getTotalWalletBalance = function() {
    return window.getGrandTotalBalance();
};

window.openProfileFinance = function(profId) {
    if (!window.canManageWallet || !window.canManageWallet(profId)) {
        return window.toast(window.t("wallet_no_access"), true);
    }
    window._homeFinanceProf = profId;
    window.renderHomeFinancePanel(profId);
    window.updateHomeFinanceSummary();
    const m = window.el("modal-home-finance");
    const title = window.el("home-finance-fs-title");
    if (title) {
        if (profId === "general") title.textContent = window.t("reserve_fund");
        else {
            const p = window.state.profiles.find(x => x.id === profId);
            title.textContent = p ? `${p.icon} ${p.name}` : window.t("finance_panel");
        }
    }
    if (m) m.style.display = "flex";
};

window.openHomeFinanceFullscreen = window.openProfileFinance;

window.closeHomeFinanceFullscreen = function() {
    window._homeFinanceProf = null;
    const m = window.el("modal-home-finance");
    if (m) m.style.display = "none";
};

window.updateHomeFinanceSummary = function() {
    const avail = window.getProfilesWalletSum();
    const reserve = window.getReserveBalance();
    const grand = avail + reserve;
    window.setTxt("fs-available-sum", window.formatM(avail));
    window.setTxt("fs-reserve-sum", window.formatM(reserve));
    window.setTxt("fs-grand-sum", window.formatM(grand));
};

window.getHomeBalanceRows = function() {
    const rows = [];
    const list = (window.getSortedProfiles ? window.getSortedProfiles() : window.state.profiles.filter(p => !p.archived))
        .filter(p => p.id !== "general");
    list.forEach(p => {
        let label;
        if (String(p.id).startsWith("creator_")) {
            label = window.t("me_label");
        } else if (p.id === "home_profile") {
            label = window.t("home_wallet_label");
        } else if (String(p.id).startsWith("user_") || p.role === "guest" || p.linked_uid) {
            label = `${window.getRelationLabel(p)}: ${p.name}`;
        } else {
            label = `${p.name}`;
        }
        rows.push({
            id: p.id,
            label,
            amount: window.getWalletBalance(p.id),
            icon: p.icon || "👤"
        });
    });
    return rows;
};

window.getInvitedChatProfiles = function() {
    return (window.getSortedProfiles ? window.getSortedProfiles() : window.state.profiles)
        .filter(p => !p.archived && (String(p.id).startsWith("user_") || p.role === "guest" || p.linked_uid));
};

window.addWalletLedger = function(entry) {
    window.ensureHomeState();
    const row = {
        id: Date.now(),
        date: new Date().toISOString().slice(0, 10),
        time: new Date().toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" }),
        user: window.tgUser || "Siz",
        ...entry
    };
    window.state.walletLedger.unshift(row);
    if (window.state.walletLedger.length > 300) window.state.walletLedger.length = 300;
    return row;
};

window.transferWallet = function(fromId, toId, amount, note) {
    amount = parseFloat(amount) || 0;
    if (amount <= 0) return window.toast(window.t("amount_required"), true);
    if (fromId === "general" && !window.isBudgetAdmin()) {
        return window.toast(window.t("admin_only_general"), true);
    }
    window.ensureHomeState();
    const fromBal = window.getWalletBalance(fromId);
    if (fromBal < amount) return window.toast(window.t("not_enough_balance"), true);
    window.state.wallets[fromId] = fromBal - amount;
    window.state.wallets[toId] = window.getWalletBalance(toId) + amount;
    window.addWalletLedger({
        type: "transfer",
        fromProf: fromId,
        toProf: toId,
        amount,
        note: note || ""
    });
    window.save(true);
    window.renderHomeTab();
    window.refreshHomeFinanceIfOpen();
    window.updateHomeFinanceSummary();
    window.updateHeaderBalance();
    window.toast(window.t("transfer_done"));
};

window.transferAllFromGeneral = function(toId) {
    if (!window.isBudgetAdmin()) return window.toast(window.t("admin_only_general"), true);
    const amt = window.getWalletBalance("general");
    if (amt <= 0) return window.toast(window.t("not_enough_balance"), true);
    window.transferWallet("general", toId, amt, window.t("transfer_all_note"));
};

window.depositToWallet = function(profId, amount, note) {
    amount = parseFloat(amount) || 0;
    if (amount <= 0) return window.toast(window.t("amount_required"), true);
    if (!window.canManageWallet(profId)) return window.toast(window.t("wallet_no_access"), true);
    if (profId === "general" && !window.isBudgetAdmin()) {
        return window.toast(window.t("admin_only_general"), true);
    }
    window.ensureHomeState();
    window.state.wallets[profId] = window.getWalletBalance(profId) + amount;
    window.addWalletLedger({
        type: "deposit",
        fromProf: null,
        toProf: profId,
        amount,
        note: note || window.t("deposit_note")
    });
    window.save(true);
    window.renderHomeTab();
    window.refreshHomeFinanceIfOpen();
    window.updateHomeFinanceSummary();
    window.updateHeaderBalance();
    window.toast(window.t("saved_auto"));
};

window.withdrawFromWallet = function(profId, amount, note) {
    amount = parseFloat(amount) || 0;
    if (amount <= 0) return window.toast(window.t("amount_required"), true);
    if (!window.canManageWallet(profId)) return window.toast(window.t("wallet_no_access"), true);
    if (profId === "general" && !window.isBudgetAdmin()) {
        return window.toast(window.t("admin_only_general"), true);
    }
    const bal = window.getWalletBalance(profId);
    if (bal < amount) return window.toast(window.t("not_enough_balance"), true);
    window.ensureHomeState();
    window.state.wallets[profId] = bal - amount;
    window.addWalletLedger({
        type: "withdraw",
        fromProf: profId,
        toProf: null,
        amount,
        note: note || window.t("withdraw_note")
    });
    window.save(true);
    window.renderHomeTab();
    window.refreshHomeFinanceIfOpen();
    window.updateHomeFinanceSummary();
    window.updateHeaderBalance();
    window.toast(window.t("saved_auto"));
};

window.getWalletLedgerFor = function(profId) {
    window.ensureHomeState();
    return window.state.walletLedger.filter(e =>
        e.fromProf === profId || e.toProf === profId ||
        (profId === "general" && (e.fromProf === "general" || e.toProf === "general"))
    );
};

window.getProfName = function(id) {
    if (!id) return "—";
    const p = window.state.profiles.find(x => x.id === id);
    return p ? p.name : id;
};

window.formatLedgerRow = function(e) {
    const amt = window.formatM(e.amount);
    let desc = "";
    if (e.type === "transfer") {
        desc = `${window.getProfName(e.fromProf)} → ${window.getProfName(e.toProf)}`;
    } else if (e.type === "deposit") {
        desc = `+ ${window.getProfName(e.toProf)}`;
    } else {
        desc = `− ${window.getProfName(e.fromProf)}`;
    }
    const who = (e.user || "Siz").replace(/</g, "&lt;");
    return `<div class="wallet-ledger-row">
        <div class="wallet-ledger-row__main">
            <div class="wallet-ledger-row__desc">${desc}</div>
            <div class="wallet-ledger-row__meta">${e.date} · ${e.time} · 👤 ${who}${e.note ? " · " + e.note.replace(/</g, "&lt;") : ""}</div>
        </div>
        <div class="wallet-ledger-row__amt">${amt}</div>
    </div>`;
};

window.toggleHomeFinancePanel = window.openHomeFinanceFullscreen;

window.openWalletHistory = function(profId) {
    window._walletHistoryProf = profId;
    const modal = window.el("modal-wallet-history");
    const list = window.el("wallet-history-list");
    const title = window.el("wallet-history-title");
    if (!modal || !list) return;
    const rows = window.getWalletLedgerFor(profId);
    if (title) {
        title.textContent = profId === "general"
            ? window.t("general_history")
            : window.getProfName(profId);
    }
    list.innerHTML = rows.length
        ? rows.map(window.formatLedgerRow).join("")
        : `<div class="wallet-ledger-empty">${window.t("history_empty")}</div>`;
    modal.classList.remove("hidden");
    modal.style.display = "flex";
};

window.closeWalletHistory = function() {
    if (window.closeModal) window.closeModal("modal-wallet-history");
};

window.renderHomeFinancePanel = function(profId) {
    const panel = window.el("home-finance-panel");
    if (!panel) return;
    profId = profId || window._homeFinanceProf;
    if (!profId) return;
    const isAdmin = window.isBudgetAdmin();
    const profiles = (window.getSortedProfiles ? window.getSortedProfiles() : window.state.profiles)
        .filter(p => !p.archived && p.id !== "general");

    let html = "";

    if (profId === "general" && isAdmin) {
        html += `
        <div class="wallet-mgmt-block wallet-mgmt-block--general">
            <div class="wallet-mgmt-block__head">
                <span>${window.t("reserve_fund")}</span>
                <strong>${window.formatM(window.getReserveBalance())}</strong>
                <button type="button" class="wallet-eye-btn" onclick="window.openWalletHistory('general')" aria-label="History">👁</button>
            </div>
            <div class="wallet-mgmt-block__row">
                <select id="wallet-general-target" class="input-text wallet-mgmt-select">
                    ${profiles.map(p => `<option value="${p.id}">${p.icon} ${p.name}</option>`).join("")}
                </select>
                <input type="text" inputmode="numeric" id="wallet-general-amt" class="input-text wallet-mgmt-amt" placeholder="${window.t("amount")}" oninput="formatSpace(this)" />
                <button type="button" class="wallet-action-btn wallet-action-btn--all" onclick="window.transferAllFromGeneral(window.val('wallet-general-target'))" title="${window.t("transfer_all")}">⤴</button>
            </div>
            <button type="button" class="wallet-mgmt-submit" onclick="window.transferWallet('general', window.val('wallet-general-target'), window.getNum('wallet-general-amt'))">
                ${window.t("transfer_from_reserve")}
            </button>
            <div class="wallet-mgmt-block__row" style="margin-top:8px;">
                <input type="text" inputmode="numeric" id="wallet-reserve-amt" class="input-text wallet-mgmt-amt" placeholder="${window.t("amount")}" oninput="formatSpace(this)" style="flex:1;" />
                <button type="button" class="wallet-action-btn wallet-action-btn--in" onclick="window.depositToWallet('general', window.getNum('wallet-reserve-amt'))" title="${window.t("deposit")}">+</button>
                <button type="button" class="wallet-action-btn wallet-action-btn--out" onclick="window.withdrawFromWallet('general', window.getNum('wallet-reserve-amt'))" title="${window.t("withdraw")}">−</button>
            </div>
        </div>`;
    } else {
        const p = window.state.profiles.find(x => x.id === profId);
        if (!p || !window.canManageWallet(profId)) {
            panel.innerHTML = `<div class="wallet-ledger-empty">${window.t("wallet_no_access")}</div>`;
            return;
        }
        html += `
        <div class="wallet-mgmt-block">
            <div class="wallet-mgmt-block__head">
                <span>${p.icon} ${p.name}</span>
                <strong>${window.formatM(window.getWalletBalance(p.id))}</strong>
                <button type="button" class="wallet-eye-btn" onclick="window.openWalletHistory('${p.id}')" aria-label="History">👁</button>
            </div>
            <div class="wallet-mgmt-block__row">
                <input type="text" inputmode="numeric" id="wallet-amt-${p.id}" class="input-text wallet-mgmt-amt" placeholder="${window.t("amount")}" oninput="formatSpace(this)" />
                <button type="button" class="wallet-action-btn wallet-action-btn--in" onclick="window.depositToWallet('${p.id}', window.getNum('wallet-amt-${p.id}'))" title="${window.t("deposit")}">+</button>
                <button type="button" class="wallet-action-btn wallet-action-btn--out" onclick="window.withdrawFromWallet('${p.id}', window.getNum('wallet-amt-${p.id}'))" title="${window.t("withdraw")}">−</button>
            </div>
        </div>`;
    }

    panel.innerHTML = html;
};

window.initHomeBalancePress = function(el, profId) {
    if (!el || el._homePressInit) return;
    el._homePressInit = true;
    let timer = null;
    let longDone = false;
    let startX = 0, startY = 0;

    const clearTimer = () => {
        if (timer) { clearTimeout(timer); timer = null; }
        el.classList.remove("home-balance-cell--hold");
        el.classList.remove("home-finance-card__reserve--hold");
    };

    el.addEventListener("pointerdown", e => {
        if (!window.canManageWallet(profId)) return;
        longDone = false;
        startX = e.clientX;
        startY = e.clientY;
        el.classList.add(profId === "general" ? "home-finance-card__reserve--hold" : "home-balance-cell--hold");
        clearTimer();
        timer = setTimeout(() => {
            timer = null;
            longDone = true;
            el.classList.remove("home-balance-cell--hold");
            el.classList.remove("home-finance-card__reserve--hold");
            if (navigator.vibrate) navigator.vibrate(40);
            window.openProfileFinance(profId);
        }, 500);
    });

    el.addEventListener("pointermove", e => {
        if (!timer) return;
        if (Math.hypot(e.clientX - startX, e.clientY - startY) > 12) clearTimer();
    });

    el.addEventListener("pointerup", () => clearTimer());
    el.addEventListener("pointercancel", clearTimer);
    el.addEventListener("click", e => {
        if (longDone) { e.preventDefault(); longDone = false; }
    });
};

window.bindHomeFinancePress = function() {
    const reserve = window.el("home-reserve-row");
    if (reserve) window.initHomeBalancePress(reserve, "general");
};

window.refreshHomeFinanceIfOpen = function() {
    const m = window.el("modal-home-finance");
    if (m && m.style.display === "flex" && window._homeFinanceProf) {
        window.renderHomeFinancePanel(window._homeFinanceProf);
    }
};

window.renderHomeChatStrip = function() {
    const strip = window.el("home-chat-strip");
    if (!strip) return;
    const invited = window.getInvitedChatProfiles();
    if (!invited.length) {
        strip.innerHTML = "";
        strip.classList.add("hidden");
        return;
    }
    strip.classList.remove("hidden");
    strip.innerHTML = `
        <div class="home-chat-strip__label">${window.t("chat_with")}</div>
        <div class="home-chat-strip__btns">
            ${invited.map(p => `
                <button type="button" class="home-chat-btn" onclick="window.openProfileChat('${p.id}')">
                    ${p.icon} ${p.name}
                </button>
            `).join("")}
        </div>`;
};

window.openProfileChat = function(profId) {
    window._chatProfId = profId;
    const p = window.state.profiles.find(x => x.id === profId);
    const modal = window.el("modal-profile-chat");
    const title = window.el("profile-chat-title");
    if (title) title.textContent = p ? `${p.icon} ${p.name}` : window.t("chat");
    window.renderProfileChatMessages();
    if (modal) { modal.classList.remove("hidden"); modal.style.display = "flex"; }
};

window.closeProfileChat = function() {
    const modal = window.el("modal-profile-chat");
    if (modal) { modal.classList.add("hidden"); modal.style.display = "none"; }
    window._chatProfId = null;
};

window.renderProfileChatMessages = function() {
    const box = window.el("profile-chat-messages");
    const profId = window._chatProfId;
    if (!box || !profId) return;
    window.ensureHomeState();
    const msgs = window.state.chats[profId] || [];
    const me = window.tgUser || "Siz";
    box.innerHTML = msgs.length ? msgs.map(m => {
        const mine = m.user === me;
        return `<div class="chat-bubble${mine ? " chat-bubble--mine" : ""}"><div class="chat-bubble__text">${(m.text || "").replace(/</g, "&lt;")}</div><div class="chat-bubble__meta">${m.time || ""} · ${(m.user || "").replace(/</g, "&lt;")}</div></div>`;
    }).join("") : `<div class="chat-empty">${window.t("chat_empty")}</div>`;
    box.scrollTop = box.scrollHeight;
};

window.sendProfileChat = function() {
    const profId = window._chatProfId;
    const inp = window.el("profile-chat-input");
    if (!profId || !inp) return;
    const text = (inp.value || "").trim();
    if (!text) return;
    window.ensureHomeState();
    if (!window.state.chats[profId]) window.state.chats[profId] = [];
    window.state.chats[profId].push({
        id: Date.now(),
        text,
        user: window.tgUser || "Siz",
        uid: window.tgUserId ? String(window.tgUserId) : null,
        time: new Date().toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })
    });
    inp.value = "";
    window.save(true);
    window.renderProfileChatMessages();
    if (window.updateHeaderNotifications) window.updateHeaderNotifications();
};

window.renderHomeTab = function() {
    window.ensureHomeState();
    const avail = window.getProfilesWalletSum();
    const reserve = window.getReserveBalance();

    window.setTxt("main-total-balance", window.formatM(avail));
    window.setTxt("home-reserve-balance", window.formatM(reserve));

    const grid = window.el("home-balance-grid");
    if (grid) {
        const rows = window.getHomeBalanceRows();
        grid.innerHTML = rows.map(r => {
            const canManage = window.canManageWallet && window.canManageWallet(r.id);
            return `
            <div class="home-balance-cell${canManage ? " home-balance-cell--interactive" : ""}" data-prof-id="${r.id}">
                <span class="home-balance-cell__icon">${r.icon}</span>
                <span class="home-balance-cell__lbl">${r.label.replace(/</g, "&lt;")}</span>
                <span class="home-balance-cell__amt">${window.formatM(r.amount)}</span>
            </div>`;
        }).join("");
        grid.querySelectorAll(".home-balance-cell[data-prof-id]").forEach(cell => {
            const pid = cell.getAttribute("data-prof-id");
            if (pid) window.initHomeBalancePress(cell, pid);
        });
    }

    window.bindHomeFinancePress();

    window.updateHomeFinanceSummary();
    window.renderHomeChatStrip();
};
