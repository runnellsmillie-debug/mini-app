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
    if (window.tRoleLabel && p.role) return window.tRoleLabel(p.role);
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
    if (!window.canViewWallet || !window.canViewWallet(profId)) {
        return window.toast(window.t("wallet_no_access"), true);
    }
    window._homeFinanceProf = profId;
    window.renderHomeFinancePanel(profId);
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

window.updateHomeFinanceSummary = function() {};

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
    const mine = new Set(window.getMyLinkedProfileIds ? window.getMyLinkedProfileIds() : []);
    return (window.getSortedProfiles ? window.getSortedProfiles() : window.state.profiles)
        .filter(p => {
            if (p.archived || p.id === "general") return false;
            if (mine.has(p.id) || (window.isMyProfile && window.isMyProfile(p))) return false;
            if (String(p.id).startsWith("user_")) return true;
            if (p.role === "guest" || p.role === "spouse" || p.role === "relative") return true;
            if (p.linked_uid && !mine.has(p.id)) return true;
            return false;
        });
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
    if (!toId || fromId === toId) return window.toast(window.t("amount_required"), true);
    if (fromId === "general" && !window.canManageWallet("general")) {
        return window.toast(window.t("admin_only_general"), true);
    } else if (fromId !== "general" && !window.canManageWallet(fromId)) {
        return window.toast(window.t("wallet_no_access"), true);
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
    window.updateHeaderBalance();
    window.toast(window.t("transfer_done"));
};

window.transferAllToGeneral = function(fromId) {
    if (!window.canManageWallet(fromId)) return window.toast(window.t("wallet_no_access"), true);
    const amt = window.getWalletBalance(fromId);
    if (amt <= 0) return window.toast(window.t("not_enough_balance"), true);
    window.transferWallet(fromId, "general", amt, window.t("return_all_to_reserve"));
};

window.transferAllFromGeneral = function(toId) {
    if (!window.canManageWallet("general")) return window.toast(window.t("admin_only_general"), true);
    const amt = window.getWalletBalance("general");
    if (amt <= 0) return window.toast(window.t("not_enough_balance"), true);
    window.transferWallet("general", toId, amt, window.t("transfer_all_note"));
};

window.depositToWallet = function(profId, amount, note, internal) {
    if (!internal) return window.toast(window.t("income_via_add_only"), true);
    amount = parseFloat(amount) || 0;
    if (amount <= 0) return;
    if (profId !== "general") return;
    window.ensureHomeState();
    window.state.wallets[profId] = window.getWalletBalance(profId) + amount;
    window.addWalletLedger({
        type: "deposit",
        fromProf: null,
        toProf: profId,
        amount,
        note: note || window.t("deposit_note")
    });
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
    window.updateHeaderBalance();
    window.toast(window.t("saved_auto"));
};

window.getWalletLedgerFor = function(profId) {
    window.ensureHomeState();
    return window.state.walletLedger.filter(e =>
        e.fromProf === profId || e.toProf === profId ||
        (profId === "general" && (e.fromProf === "general" || e.toProf === "general" || e.toProf === null && e.type === "income"))
    );
};

window.getLedgerDirection = function(e, profId) {
    if (e.toProf === profId) return "in";
    if (e.fromProf === profId) return "out";
    return "neutral";
};

window.getProfName = function(id) {
    if (!id) return "—";
    const p = window.state.profiles.find(x => x.id === id);
    return p ? p.name : id;
};

window.formatLedgerRow = function(e, profId) {
    profId = profId || window._walletHistoryProf;
    const dir = window.getLedgerDirection(e, profId);
    const amt = window.formatM(e.amount);
    const who = (e.user || "Siz").replace(/</g, "&lt;");
    let desc = "";
    let sign = dir === "in" ? "+" : dir === "out" ? "−" : "";

    if (dir === "in") {
        if (e.type === "transfer") {
            desc = `${window.getProfName(e.fromProf)} ${window.t("ledger_from")}`;
        } else if (e.type === "income" || e.type === "deposit") {
            desc = window.t("ledger_income");
        } else {
            desc = window.t("ledger_received");
        }
    } else if (dir === "out") {
        if (e.type === "transfer") {
            if (e.toProf === "general") {
                desc = window.t("return_to_reserve");
            } else {
                desc = `${window.getProfName(e.toProf)} ${window.t("ledger_to")}`;
            }
        } else {
            desc = window.t("ledger_sent");
        }
    } else if (e.type === "transfer") {
        desc = `${window.getProfName(e.fromProf)} → ${window.getProfName(e.toProf)}`;
    }

    const note = e.note ? ` · ${e.note.replace(/</g, "&lt;")}` : "";
    return `<div class="wallet-ledger-row wallet-ledger-row--${dir}">
        <div class="wallet-ledger-row__main">
            <div class="wallet-ledger-row__desc">${sign ? `<span class="wallet-ledger-row__sign">${sign}</span> ` : ""}${desc}</div>
            <div class="wallet-ledger-row__meta">${e.date} · ${e.time} · 👤 ${who}${note}</div>
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
        ? rows.map(e => window.formatLedgerRow(e, profId)).join("")
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
    const isAdmin = window.canManageWallet("general");
    const canManage = window.canManageWallet(profId);
    const targets = window.getTransferTargets ? window.getTransferTargets(profId) : [];

    let html = "";

    if (profId === "general") {
        html += `
        <div class="wallet-mgmt-block wallet-mgmt-block--general">
            <div class="wallet-mgmt-block__head">
                <span>${window.t("reserve_fund")}</span>
                <strong>${window.formatM(window.getReserveBalance())}</strong>
                <button type="button" class="wallet-eye-btn" onclick="window.openWalletHistory('general')" aria-label="History">👁</button>
            </div>`;
        if (isAdmin) {
            html += `
            <div class="wallet-mgmt-block__row">
                <select id="wallet-general-target" class="input-text wallet-mgmt-select">
                    ${targets.map(p => `<option value="${p.id}">${p.icon} ${p.name}</option>`).join("")}
                </select>
                <input type="text" inputmode="numeric" id="wallet-general-amt" class="input-text wallet-mgmt-amt" placeholder="${window.t("amount")}" oninput="formatSpace(this)" />
                <button type="button" class="wallet-action-btn wallet-action-btn--all" onclick="window.transferAllFromGeneral(window.val('wallet-general-target'))" title="${window.t("transfer_all")}">⤴</button>
            </div>
            <button type="button" class="wallet-mgmt-submit" onclick="window.transferWallet('general', window.val('wallet-general-target'), window.getNum('wallet-general-amt'))">
                ${window.t("transfer_from_reserve")}
            </button>`;
        } else {
            html += `<div class="wallet-view-only">${window.t("wallet_view_only")}</div>`;
        }
        html += `</div>`;
    } else {
        const p = window.state.profiles.find(x => x.id === profId);
        if (!p || !canManage) {
            panel.innerHTML = `<div class="wallet-ledger-empty">${window.t("wallet_no_access")}</div>`;
            return;
        }
        html += `
        <div class="wallet-mgmt-block">
            <div class="wallet-mgmt-block__head">
                <span>${p.icon} ${p.name}</span>
                <strong>${window.formatM(window.getWalletBalance(p.id))}</strong>
                <button type="button" class="wallet-eye-btn" onclick="window.openWalletHistory('${p.id}')" aria-label="History">👁</button>
            </div>`;
        if (targets.length) {
            html += `
            <div class="wallet-mgmt-section-label">${window.t("transfer_to_profile")}</div>
            <div class="wallet-mgmt-block__row">
                <select id="wallet-transfer-target-${p.id}" class="input-text wallet-mgmt-select">
                    ${targets.map(t => `<option value="${t.id}">${t.icon} ${t.name}</option>`).join("")}
                </select>
                <input type="text" inputmode="numeric" id="wallet-transfer-amt-${p.id}" class="input-text wallet-mgmt-amt" placeholder="${window.t("amount")}" oninput="formatSpace(this)" />
            </div>
            <button type="button" class="wallet-mgmt-submit" onclick="window.transferWallet('${p.id}', window.val('wallet-transfer-target-${p.id}'), window.getNum('wallet-transfer-amt-${p.id}'))">
                ${window.t("transfer_to_profile")}
            </button>`;
        }
        html += `
            <div class="wallet-mgmt-section-label">${window.t("return_to_reserve")}</div>
            <div class="wallet-mgmt-block__row">
                <input type="text" inputmode="numeric" id="wallet-return-amt-${p.id}" class="input-text wallet-mgmt-amt" placeholder="${window.t("amount")}" oninput="formatSpace(this)" style="flex:1;" />
                <button type="button" class="wallet-action-btn wallet-action-btn--all" onclick="window.transferAllToGeneral('${p.id}')" title="${window.t("return_all_to_reserve")}">⤴</button>
            </div>
            <button type="button" class="wallet-mgmt-submit wallet-mgmt-submit--reserve" onclick="window.transferWallet('${p.id}', 'general', window.getNum('wallet-return-amt-${p.id}'), window.t('return_to_reserve'))">
                ${window.t("return_to_reserve")}
            </button>
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
    };

    el.addEventListener("pointerdown", e => {
        if (e.target.closest(".home-balance-eye") || e.target.closest(".home-balance-action")) return;
        const canOpen = profId === "general"
            ? (window.canViewWallet && window.canViewWallet(profId))
            : (window.canManageWallet && window.canManageWallet(profId));
        if (!canOpen) return;
        longDone = false;
        startX = e.clientX;
        startY = e.clientY;
        el.classList.add("home-balance-cell--hold");
        clearTimer();
        timer = setTimeout(() => {
            timer = null;
            longDone = true;
            el.classList.remove("home-balance-cell--hold");
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
    if (reserve && !reserve._homePressInit) {
        window.initHomeBalancePress(reserve, "general");
    }
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
        <div class="home-chat-strip__head">
            <div class="home-chat-strip__title">
                <span class="home-chat-strip__icon">💬</span>
                <span>${window.t("chat_with")}</span>
            </div>
        </div>
        <div class="home-chat-strip__list">
            ${invited.map(p => {
                const unread = window.getUnreadCountForProf(p.id);
                const msgs = window.getChatMessagesFor(p.id);
                const last = msgs[msgs.length - 1];
                const preview = last
                    ? (window.isChatMessageMine(last) ? "Siz: " : "") + window.formatChatPreview(last.text)
                    : window.t("chat_empty");
                const time = last?.time || "";
                return `
                <button type="button" class="home-chat-card${unread ? " home-chat-card--unread" : ""}" onclick="window.openProfileChat('${p.id}')">
                    <span class="home-chat-card__avatar">${p.icon || "👤"}</span>
                    <span class="home-chat-card__body">
                        <span class="home-chat-card__top">
                            <span class="home-chat-card__name">${(p.name || "").replace(/</g, "&lt;")}</span>
                            ${time ? `<span class="home-chat-card__time">${time}</span>` : ""}
                        </span>
                        <span class="home-chat-card__preview">${preview.replace(/</g, "&lt;")}</span>
                    </span>
                    ${unread ? `<span class="home-chat-card__badge">${unread > 9 ? "9+" : unread}</span>` : ""}
                </button>`;
            }).join("")}
        </div>`;
};

window.getMyPrimaryProfileId = function() {
    const ids = window.getMyLinkedProfileIds ? window.getMyLinkedProfileIds() : [];
    if (ids.length) return ids[0];
    const lp = window.getMyLinkedProfiles ? window.getMyLinkedProfiles() : [];
    return lp[0]?.id || null;
};

window.getChatRoomKey = function(otherProfId) {
    const myId = window.getMyPrimaryProfileId();
    if (!myId || !otherProfId || myId === otherProfId) return otherProfId;
    return [myId, otherProfId].sort().join("__");
};

window.mergeChatMessages = function(a, b) {
    const map = new Map();
    [...(a || []), ...(b || [])].forEach(m => {
        if (!m || m.id == null) return;
        const prev = map.get(m.id);
        if (prev) {
            m = {
                ...prev,
                ...m,
                readBy: { ...(prev.readBy || {}), ...(m.readBy || {}) }
            };
        }
        map.set(m.id, m);
    });
    return [...map.values()].sort((x, y) => x.id - y.id);
};

window.ensureChatRoom = function(otherProfId) {
    window.ensureHomeState();
    const roomKey = window.getChatRoomKey(otherProfId);
    const myId = window.getMyPrimaryProfileId();
    let msgs = window.state.chats[roomKey] || [];
    let migrated = false;
    [otherProfId, myId].filter(Boolean).forEach(id => {
        if (id === roomKey) return;
        const leg = window.state.chats[id];
        if (leg?.length) {
            msgs = window.mergeChatMessages(msgs, leg);
            delete window.state.chats[id];
            migrated = true;
        }
    });
    window.state.chats[roomKey] = msgs;
    if (migrated) window.save(true);
    return roomKey;
};

window.getChatMessagesFor = function(otherProfId) {
    const roomKey = window.ensureChatRoom(otherProfId);
    return window.state.chats[roomKey] || [];
};

window.isChatMessageMine = function(m) {
    const me = window.tgUserId ? String(window.tgUserId) : "";
    if (me && m.uid) return String(m.uid) === me;
    return (m.user || "") === (window.tgUser || "Siz");
};

window.getUnreadCountForProf = function(otherProfId) {
    const roomKey = window.getChatRoomKey(otherProfId);
    const seen = window.getChatSeenIds(roomKey);
    return window.getChatMessagesFor(otherProfId).filter(m => !window.isChatMessageMine(m) && !seen.has(m.id)).length;
};

window.markChatRead = function(otherProfId) {
    const me = window.tgUserId ? String(window.tgUserId) : "";
    if (!me) return;
    const roomKey = window.getChatRoomKey(otherProfId);
    const seen = window.getChatSeenIds(roomKey);
    let changed = false;
    window.getChatMessagesFor(otherProfId).forEach(m => {
        if (window.isChatMessageMine(m)) return;
        seen.add(m.id);
        if (!m.readBy) m.readBy = {};
        if (!m.readBy[me]) {
            m.readBy[me] = Date.now();
            changed = true;
        }
    });
    window.saveChatSeenIds(roomKey, seen);
    if (changed) window.save(true);
};

window.isChatMessageRead = function(m) {
    if (!m?.readBy) return false;
    const me = window.tgUserId ? String(window.tgUserId) : "";
    return Object.keys(m.readBy).some(uid => uid && uid !== me);
};

window.formatChatPreview = function(text) {
    const t = (text || "").replace(/\s+/g, " ").trim();
    return t.length > 40 ? t.slice(0, 40) + "…" : t;
};

window.openProfileChat = function(profId) {
    window._chatProfId = profId;
    const p = window.state.profiles.find(x => x.id === profId);
    const modal = window.el("modal-profile-chat");
    const title = window.el("profile-chat-title");
    const status = window.el("profile-chat-status");
    if (title) title.textContent = p ? p.name : window.t("chat");
    if (status) status.textContent = window.t("chat_online");
    window.ensureChatRoom(profId);
    window.markChatRead(profId);
    window.renderProfileChatMessages();
    if (modal) { modal.classList.remove("hidden"); modal.style.display = "flex"; }
    const inp = window.el("profile-chat-input");
    if (inp) setTimeout(() => inp.focus(), 120);
    window.startChatLiveSync();
    window.syncOpenChatFromCloud();
    if (window.updateHeaderNotifications) window.updateHeaderNotifications();
};

window.closeProfileChat = function() {
    const modal = window.el("modal-profile-chat");
    if (modal) { modal.classList.add("hidden"); modal.style.display = "none"; }
    window._chatProfId = null;
    window.stopChatLiveSync();
    if (window.renderHomeChatStrip) window.renderHomeChatStrip();
};

window.renderProfileChatMessages = function() {
    const box = window.el("profile-chat-messages");
    const profId = window._chatProfId;
    if (!box || !profId) return;
    const msgs = window.getChatMessagesFor(profId);
    const wasAtBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;

    if (!msgs.length) {
        box.innerHTML = `<div class="chat-empty">${window.t("chat_empty")}</div>`;
        return;
    }

    let lastDate = "";
    const parts = [];
    msgs.forEach(m => {
        const d = new Date(m.id);
        const dateKey = isNaN(d.getTime()) ? "" : d.toLocaleDateString("uz-UZ", { day: "numeric", month: "short" });
        if (dateKey && dateKey !== lastDate) {
            lastDate = dateKey;
            parts.push(`<div class="chat-date-sep"><span>${dateKey}</span></div>`);
        }
        const mine = window.isChatMessageMine(m);
        const text = (m.text || "").replace(/</g, "&lt;").replace(/\n/g, "<br>");
        const read = mine && window.isChatMessageRead(m);
        const ticks = mine ? `<span class="chat-bubble__ticks${read ? " chat-bubble__ticks--read" : ""}">${read ? "✓✓" : "✓"}</span>` : "";
        parts.push(`
            <div class="chat-row${mine ? " chat-row--mine" : " chat-row--other"}">
                <div class="chat-bubble${mine ? " chat-bubble--mine" : ""}">
                    <div class="chat-bubble__text">${text}</div>
                    <div class="chat-bubble__foot">
                        <span class="chat-bubble__time">${m.time || ""}</span>
                        ${ticks}
                    </div>
                </div>
            </div>`);
    });
    box.innerHTML = parts.join("");
    if (wasAtBottom) box.scrollTop = box.scrollHeight;
};

window.sendProfileChat = function() {
    const profId = window._chatProfId;
    const inp = window.el("profile-chat-input");
    if (!profId || !inp) return;
    const text = (inp.value || "").trim();
    if (!text) return;
    window.ensureHomeState();
    const roomKey = window.ensureChatRoom(profId);
    window.state.chats[roomKey].push({
        id: Date.now(),
        text,
        user: window.tgUser || "Siz",
        uid: window.tgUserId ? String(window.tgUserId) : null,
        time: new Date().toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" }),
        readBy: {}
    });
    inp.value = "";
    window.save(true);
    window.renderProfileChatMessages();
    window.renderHomeChatStrip();
    if (window.updateHeaderNotifications) window.updateHeaderNotifications();
    setTimeout(() => window.syncOpenChatFromCloud && window.syncOpenChatFromCloud(), 350);
};

window.syncOpenChatFromCloud = async function() {
    if (!window._chatProfId || !window.currentBudgetId) return;
    const cloud = await window.fetchCloudState();
    if (!cloud?.chats) return;
    const profId = window._chatProfId;
    const roomKey = window.ensureChatRoom(profId);
    const myId = window.getMyPrimaryProfileId();
    let cloudMerged = [];
    [roomKey, profId, myId].filter(Boolean).forEach(key => {
        if (cloud.chats[key]?.length) {
            cloudMerged = window.mergeChatMessages(cloudMerged, cloud.chats[key]);
        }
    });
    const local = window.state.chats[roomKey] || [];
    const merged = window.mergeChatMessages(local, cloudMerged);
    const dataChanged = JSON.stringify(merged) !== JSON.stringify(local);
    window.state.chats[roomKey] = merged;
    window.markChatRead(profId);
    window.renderProfileChatMessages();
    if (dataChanged) {
        window.renderHomeChatStrip();
        if (window.updateHeaderNotifications) window.updateHeaderNotifications();
    }
};

window.startChatLiveSync = function() {
    window.stopChatLiveSync();
    window._chatSyncTimer = setInterval(() => window.syncOpenChatFromCloud(), 1200);
};

window.stopChatLiveSync = function() {
    if (window._chatSyncTimer) {
        clearInterval(window._chatSyncTimer);
        window._chatSyncTimer = null;
    }
};

window.onCloudStateApplied = function() {
    if (window._chatProfId) {
        window.ensureChatRoom(window._chatProfId);
        window.renderProfileChatMessages();
    }
    if (window.renderHomeChatStrip) window.renderHomeChatStrip();
    if (window.updateHeaderNotifications) window.updateHeaderNotifications();
    if (window.updatePlanBellBadge) window.updatePlanBellBadge();
};

window.renderHomeTab = function() {
    window.ensureHomeState();
    const avail = window.getProfilesWalletSum();
    const reserve = window.getReserveBalance();
    const grand = avail + reserve;

    window.setTxt("main-total-balance", window.formatM(grand));
    window.setTxt("home-reserve-balance", window.formatM(reserve));

    const grid = window.el("home-balance-grid");
    if (grid) {
        const rows = window.getHomeBalanceRows();
        grid.innerHTML = rows.map(r => {
            const canManage = window.canManageWallet && window.canManageWallet(r.id);
            const canReturn = window.canReturnToReserve && window.canReturnToReserve(r.id);
            return `
            <div class="home-balance-cell${canManage ? " home-balance-cell--interactive" : ""}" data-prof-id="${r.id}">
                <div class="home-balance-cell__left">
                    <span class="home-balance-cell__icon">${r.icon}</span>
                    <span class="home-balance-cell__lbl">${r.label.replace(/</g, "&lt;")}</span>
                </div>
                <div class="home-balance-cell__right">
                    <span class="home-balance-cell__amt">${window.formatM(r.amount)}</span>
                    ${canReturn ? `<button type="button" class="home-balance-action" onclick="event.stopPropagation(); window.openProfileFinance('${r.id}')" title="${window.t("return_to_reserve")}">↩</button>` : ""}
                    <button type="button" class="home-balance-eye" onclick="event.stopPropagation(); window.openWalletHistory('${r.id}')" aria-label="History">👁</button>
                </div>
            </div>`;
        }).join("");
        grid.querySelectorAll(".home-balance-cell[data-prof-id]").forEach(cell => {
            const pid = cell.getAttribute("data-prof-id");
            if (pid) window.initHomeBalancePress(cell, pid);
        });
    }

    window.bindHomeFinancePress();

    window.renderHomeChatStrip();
};
