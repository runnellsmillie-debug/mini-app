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
    (window.getSortedProfiles ? window.getSortedProfiles() : window.state.profiles).forEach(p => {
        if (p.archived) return;
        if (window.state.wallets[p.id] == null) {
            window.state.wallets[p.id] = Math.max(0, window.getProfileBalance(p.id));
        }
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
    window.ensureHomeState();
    return Object.values(window.state.wallets).reduce((s, v) => s + (parseFloat(v) || 0), 0);
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
    window.updateHeaderBalance();
    window.toast(window.t("saved_auto"));
};

window.withdrawFromWallet = function(profId, amount, note) {
    amount = parseFloat(amount) || 0;
    if (amount <= 0) return window.toast(window.t("amount_required"), true);
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

window.toggleHomeFinancePanel = function() {
    const panel = window.el("home-finance-panel");
    const btn = window.el("home-finance-toggle");
    if (!panel) return;
    panel.classList.toggle("hidden");
    btn?.classList.toggle("home-finance-toggle--open", !panel.classList.contains("hidden"));
};

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

window.renderHomeFinancePanel = function() {
    const panel = window.el("home-finance-panel");
    if (!panel) return;
    const isAdmin = window.isBudgetAdmin();
    const profiles = (window.getSortedProfiles ? window.getSortedProfiles() : window.state.profiles)
        .filter(p => !p.archived && p.id !== "general");

    let html = "";

    if (isAdmin) {
        html += `
        <div class="wallet-mgmt-block wallet-mgmt-block--general">
            <div class="wallet-mgmt-block__head">
                <span>${window.t("general_pool")}</span>
                <strong>${window.formatM(window.getWalletBalance("general"))}</strong>
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
                ${window.t("transfer_from_general")}
            </button>
        </div>`;
    }

    profiles.forEach(p => {
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
    });

    panel.innerHTML = html;
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
        uid: window.tgUserId || null,
        time: new Date().toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })
    });
    inp.value = "";
    window.save(true);
    window.renderProfileChatMessages();
};

window.renderHomeTab = function() {
    window.ensureHomeState();
    const total = window.getTotalWalletBalance();
    window.setTxt("main-total-balance", window.formatM(total));

    const list = window.el("home-balance-list");
    if (list) {
        const rows = window.getHomeBalanceRows();
        list.innerHTML = rows.map(r => `
            <div class="home-balance-row">
                <span class="home-balance-row__icon">${r.icon}</span>
                <span class="home-balance-row__label">${r.label.replace(/</g, "&lt;")}</span>
                <span class="home-balance-row__amt">${window.formatM(r.amount)}</span>
            </div>
        `).join("");
    }

    window.renderHomeFinancePanel();
    window.renderHomeChatStrip();
};
