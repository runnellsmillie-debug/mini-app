// ==========================================
// SERVICES.JS - Bozorlik, Rejali to'lovlar va Qarzlar
// ==========================================

// ── Yordamchi: animatsiyali toast (tashqi window.toast o'zgarmaydi) ──────────

const _fx = {
  ripple(btn) {
    const r = document.createElement("span");
    r.className = "_svc-ripple";
    const rect = btn.getBoundingClientRect();
    r.style.cssText = `width:${Math.max(rect.width, rect.height)}px;
      height:${Math.max(rect.width, rect.height)}px;
      left:${rect.width / 2}px; top:${rect.height / 2}px;`;
    btn.appendChild(r);
    setTimeout(() => r.remove(), 600);
  },
};

// Inject UI styles once
(function injectStyles() {
  if (document.getElementById("_svc-styles")) return;
  const s = document.createElement("style");
  s.id = "_svc-styles";
  s.textContent = `
/* ── Reset helpers ────────────────────────────────── */
.svc-section { margin-bottom: 24px; }

/* ── Smart Tags ───────────────────────────────────── */
#smart-tags-container {
  display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px;
}
.smart-tag {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 14px; border-radius: 20px; font-size: 12px;
  font-weight: 600; cursor: pointer; user-select: none;
  background: var(--bg-card, #1e1e2e);
  border: 1.5px solid var(--border-color, #333);
  color: var(--text, #e0e0e0);
  transition: background .18s, border-color .18s, transform .12s;
  position: relative; overflow: hidden;
}
.smart-tag:hover  { background: var(--primary, #7c5cff); border-color: var(--primary, #7c5cff); color: #fff; transform: translateY(-1px); }
.smart-tag:active { transform: scale(.95); }

/* ── Plan items ───────────────────────────────────── */
.plan-item {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 16px; border-radius: 14px;
  background: var(--bg-card, #1e1e2e);
  border: 1.5px solid var(--border-color, #2a2a3e);
  margin-bottom: 10px;
  transition: opacity .2s, background .2s;
  animation: _svc-slide-in .25s ease both;
}
.plan-item.skipped { opacity: .45; }
.plan-item:hover   { background: var(--bg-hover, #252538); }

@keyframes _svc-slide-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: none; }
}

.plan-meta { font-size: 11px; color: var(--text-muted, #888); margin-top: 4px; }
.plan-name-text { font-weight: 700; color: var(--primary, #7c5cff); font-size: 14px; }

/* ── Custom checkbox ──────────────────────────────── */
.custom-checkbox {
  width: 22px; height: 22px; border-radius: 50%;
  border: 2px solid var(--border-color, #444);
  flex-shrink: 0; cursor: pointer;
  transition: background .15s, border-color .15s, transform .1s;
  display: flex; align-items: center; justify-content: center;
}
.custom-checkbox.checked {
  background: var(--success, #4caf7d);
  border-color: var(--success, #4caf7d);
}
.custom-checkbox.checked::after { content: "✓"; font-size: 12px; color: #fff; font-weight: 800; }
.custom-checkbox:active { transform: scale(.85); }

/* ── Scheduled list item ──────────────────────────── */
.sched-list-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; border-radius: 12px;
  background: var(--bg-card, #1e1e2e);
  border: 1.5px solid var(--border-color, #2a2a3e);
  margin-bottom: 8px;
  animation: _svc-slide-in .2s ease both;
}
.sched-label { font-weight: 600; font-size: 14px; color: var(--text, #e0e0e0); }
.sched-day   { font-size: 11px; color: var(--text-muted, #888); margin-top: 2px; }

/* ── Debt type toggle ─────────────────────────────── */
.debt-type-btn {
  flex: 1; padding: 11px 0; border-radius: 10px; font-size: 13px;
  font-weight: 700; cursor: pointer; text-align: center;
  border: 2px solid var(--border-color, #333);
  background: var(--bg-card, #1e1e2e);
  color: var(--text, #e0e0e0);
  transition: background .18s, border-color .18s, color .18s, transform .1s;
}
.debt-type-btn:active { transform: scale(.96); }

/* ── Ripple ───────────────────────────────────────── */
._svc-ripple {
  position: absolute; border-radius: 50%;
  background: rgba(255,255,255,.18);
  transform: translate(-50%,-50%) scale(0);
  animation: _svc-rpl .55s linear;
  pointer-events: none;
}
@keyframes _svc-rpl { to { transform: translate(-50%,-50%) scale(2.5); opacity: 0; } }

/* ── Badge ────────────────────────────────────────── */
.svc-badge {
  display: inline-block; padding: 2px 8px; border-radius: 20px;
  font-size: 10px; font-weight: 700; letter-spacing: .5px; text-transform: uppercase;
}
.svc-badge-market { background: rgba(124,92,255,.15); color: var(--primary, #7c5cff); }
.svc-badge-cat    { background: rgba(76,175,125,.12); color: var(--success, #4caf7d); }
  `;
  document.head.appendChild(s);
})();

// ── PLAN CATEGORIES ───────────────────────────────────────────────────────────

window.updatePlanCats = () => {
  const cEl = window.el("smart-plan-cat");
  if (!cEl) return;
  const p = window.state.profiles.find(x => x.id === window.curProf);
  const isChild =
    p && p.age !== null && p.age < 16 &&
    p.id !== "general" && p.id !== "home_profile";
  let cats = isChild
    ? ["Kiyim", "Talim", "Oyinchoq"]
    : p?.id === "home_profile"
      ? ["Oziq-ovqat", "Uy_Xojalik"]
      : Object.keys(window.PLAN_TAGS);
  cEl.innerHTML = cats
    .map(x => `<option value="${x}">${x.replace(/_/g, " ")}</option>`)
    .join("");
  window.updateSmartTags();
};

window.updateSmartTags = () => {
  const cat = window.val("smart-plan-cat");
  const subEl = window.el("smart-plan-subcat");
  if (!cat || !subEl) return;
  subEl.innerHTML = "";
  if (window.PLAN_TAGS[cat]) {
    window.show("smart-plan-subcat");
    Object.keys(window.PLAN_TAGS[cat]).forEach(s => {
      subEl.innerHTML += `<option value="${s}">${s.replace(/_/g, "/")}</option>`;
    });
  } else {
    window.hide("smart-plan-subcat");
  }
  window.renderSmartTags();
};

window.renderSmartTags = () => {
  const c = window.val("smart-plan-cat");
  const s = window.val("smart-plan-subcat");
  const cont = window.el("smart-tags-container");
  if (!cont) return;
  cont.innerHTML = "";
  const tags = window.PLAN_TAGS?.[c]?.[s];
  if (tags?.length) {
    tags.forEach(t => {
      cont.innerHTML += `<div class="smart-tag" onclick="quickAddPlan('${t}')">${t}</div>`;
    });
  } else {
    cont.innerHTML = `<span style="color:var(--text-muted);font-size:12px;">Teglar yo'q.</span>`;
  }
};

window.quickAddPlan = t => {
  const ni = window.el("plan-name");
  const qi = window.el("plan-qty");
  ni.value = t;
  qi.value = "";
  ni.style.borderColor = "var(--success)";
  setTimeout(() => (ni.style.borderColor = "var(--border-color)"), 700);
  qi.focus();
  window.toast("Hajmini yozing");
};

// ── PLAN CRUD ─────────────────────────────────────────────────────────────────

window.addPlannedItemManual = () => {
  const n = window.val("plan-name").trim();
  const q = window.val("plan-qty").trim();
  const c = window.val("smart-plan-cat");
  const m = window.val("plan-market");
  const p = window.getNum("plan-price");
  if (!n) return window.toast("Nomi kerak!", true);
  window.state.plan.push({
    id: Date.now(),
    text: q ? `${n} (${q})` : n,
    cat: c, market: m, price: p,
    prof: window.curProf,
    skip: null, archived: false,
  });
  window.setVal("plan-name", "");
  window.setVal("plan-qty", "");
  window.el("plan-price").value = "";
  window.save();
  window.toast("Qo'shildi! ✅");
};

window.toggleSkipPlan = id => {
  const today = new Date().toISOString().slice(0, 10);
  const item = window.state.plan.find(x => x.id == id);
  if (item) {
    item.skip = item.skip === today ? null : today;
    window.save();
  }
};

window.openBuyModal = id => {
  const item = window.state.plan.find(x => x.id == id);
  if (!item) return;
  window.buyPlanId = id;
  window.setTxt("buy-item-name", `✅ Olinyapti: ${item.text}`);
  window.el("buy-price").value = item.price
    ? new Intl.NumberFormat("ru-RU").format(item.price).replace(/,/g, " ")
    : "";
  window.openModal("modal-buy");
};

window.confirmBuyItem = () => {
  const p = window.getNum("buy-price");
  if (!p || p <= 0) return window.toast("Narx xato!", true);
  const item = window.state.plan.find(x => x.id == window.buyPlanId);
  if (!item) return;
  const d = new Date();
  window.state.txs.unshift({
    id: Date.now(), amount: p, desc: item.text,
    cat: item.cat, subCat: item.market,
    date: d.toISOString().slice(0, 10),
    time: d.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" }),
    user: window.tgUser, prof: item.prof,
  });
  item.archived = true;
  item.buyPrice = p;
  item.buyDate = d.toISOString().slice(0, 10);
  window.closeModal("modal-buy");
  window.save();
  window.toast("Xarid amalga oshirildi ✅");
};

window.permDelPlan = id => {
  window.state.plan = window.state.plan.filter(x => x.id != id);
  window.save();
  window.toast("O'chirildi!");
};

// ── RENDER PLANNED ────────────────────────────────────────────────────────────

window.renderPlanned = () => {
  const fc = window.val("filter-cat");
  const fm = window.val("filter-market");
  const today = new Date().toISOString().slice(0, 10);

  let items = window.state.plan.filter(
    x =>
      x.prof === window.curProf ||
      window.curProf === "general" ||
      (window.curProf === "home_profile" && x.prof === "home_profile")
  );
  if (fc && fc !== "all") items = items.filter(x => x.cat === fc);
  if (fm && fm !== "all") items = items.filter(x => x.market === fm);

  const active = items.filter(x => !x.archived);

  const html = active.map(x => {
    const sk = x.skip === today;
    return `
<div class="plan-item${sk ? " skipped" : ""}">
  <div class="custom-checkbox${!sk ? " checked" : ""}" onclick="toggleSkipPlan(${x.id})"></div>
  <div style="flex:1; min-width:0;">
    <div class="plan-name-text" style="text-decoration:${sk ? "line-through" : "none"};">${x.text}</div>
    <div class="plan-meta">
      <span class="svc-badge svc-badge-market">📍 ${x.market}</span>
      <span class="svc-badge svc-badge-cat" style="margin-left:6px;">🏷 ${x.cat.replace(/_/g, " ")}</span>
    </div>
  </div>
  <button
    onclick="openBuyModal(${x.id})"
    class="btn-primary btn-success"
    style="width:auto; padding:8px 14px; font-size:12px; flex-shrink:0;"
    ${sk ? "disabled" : ""}
  >Olish</button>
</div>`;
  }).join("");

  window.setHtml(
    "planned-list-container",
    html || `<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:24px 0;">📭 Ro'yxat bo'sh.</div>`
  );
};

// ── SCHEDULED PAYMENTS ────────────────────────────────────────────────────────

window.addScheduled = () => {
  const n = window.val("sched-name").trim();
  const d = parseInt(window.val("sched-day"));
  const a = window.getNum("sched-amount");
  const c = window.val("sched-cat");
  if (!n || !d || d < 1 || d > 31 || !a) return window.toast("Ma'lumotlar xato!", true);
  const now = new Date();
  const tm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  window.state.sched.push({
    id: Date.now(), label: n, day: d, amt: a, cat: c,
    tMonth: tm, miss: 0, prof: window.curProf,
    archived: false, paidTotal: 0,
  });
  window.setVal("sched-name", "");
  window.setVal("sched-day", "");
  window.el("sched-amount").value = "";
  window.save();
  window.toast("Qo'shildi!");
};

window.delSched = id => {
  window.initCloseActionOld(() => {
    const s = window.state.sched.find(x => x.id == id);
    if (s) {
      s.archived = true;
      s.closeDate = new Date().toISOString().slice(0, 10);
      window.save();
      window.toast("Arxivlandi!");
    }
  });
};

window.permDelSched = id => {
  window.state.sched = window.state.sched.filter(x => x.id != id);
  window.save();
  window.toast("O'chirildi!");
};

window.updMiss = (id, v) => {
  const s = window.state.sched.find(x => x.id == id);
  if (s) { s.miss = parseInt(v) || 0; window.save(); }
};

window.paySched = id => {
  const s = window.state.sched.find(x => x.id == id);
  if (!s) return;

  const getWorkdays = (year, month) => {
    const days = new Date(year, month, 0).getDate();
    let wd = 0;
    for (let i = 1; i <= days; i++) {
      const day = new Date(year, month - 1, i).getDay();
      if (day !== 0 && day !== 6) wd++;
    }
    return wd;
  };

  const [yr, mo] = s.tMonth.split("-").map(Number);
  const wd = getWorkdays(yr, mo);
  const actAmt = s.miss > 0
    ? Math.max(0, Math.round(s.amt - (s.amt / wd) * s.miss))
    : s.amt;

  const d = new Date();
  window.state.txs.unshift({
    id: Date.now(), amount: actAmt,
    desc: `${s.label} (${s.tMonth})`,
    cat: s.cat, subCat: "",
    date: d.toISOString().slice(0, 10),
    time: d.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" }),
    user: window.tgUser, prof: s.prof,
  });

  s.paidTotal = (s.paidTotal || 0) + actAmt;

  let [y, m] = s.tMonth.split("-");
  m = parseInt(m) + 1;
  if (m > 12) { m = 1; y = parseInt(y) + 1; }
  s.tMonth = `${y}-${String(m).padStart(2, "0")}`;
  s.miss = 0;

  window.save();
  window.toast("To'landi ✅");
};

window.renderSchedSet = () => {
  const active = window.state.sched.filter(
    s => (s.prof === window.curProf || window.curProf === "general") && !s.archived
  );
  const html = active.map(s => `
<div class="sched-list-item">
  <div>
    <div class="sched-label">${s.label}</div>
    <div class="sched-day">📅 Har oy ${s.day}-sana</div>
  </div>
  <button onclick="delSched(${s.id})" class="delete-btn">✕</button>
</div>`).join("");
  window.setHtml("sched-edit-list", html);
};

// ── DEBTS ─────────────────────────────────────────────────────────────────────

window.setDebtType = type => {
  window.debtType = type;
  const takeBtn = window.el("debt-type-take");
  const giveBtn = window.el("debt-type-give");

  takeBtn.style.background    = type === "take" ? "var(--success)" : "var(--bg-card)";
  takeBtn.style.borderColor   = type === "take" ? "var(--success)" : "var(--border-color)";
  takeBtn.style.color         = type === "take" ? "#fff"           : "var(--text)";

  giveBtn.style.background    = type === "give" ? "var(--danger)" : "var(--bg-card)";
  giveBtn.style.borderColor   = type === "give" ? "var(--danger)" : "var(--border-color)";
  giveBtn.style.color         = type === "give" ? "#fff"          : "var(--text)";
};

window.saveDebt = () => {
  const n = window.val("debt-name").trim();
  const a = window.getNum("debt-amount");
  const s = window.val("debt-start");
  const e = window.val("debt-due");
  if (!n || !a) return window.toast("Ma'lumotlar yetarli emas!", true);

  window.state.debts.unshift({
    id: Date.now(), name: n, amount: a,
    type: window.debtType, start: s, due: e,
    archived: false,
  });

  if (window.debtType === "take") {
    window.state.txs.unshift({
      id: Date.now() + 1, amount: a, desc: `Qarz berildi: ${n}`,
      cat: "Qarz", date: s, time: "00:00",
      user: window.tgUser, prof: "general",
    });
  } else {
    window.state.incs.unshift({
      id: Date.now() + 1, amount: a, desc: `Qarz olindi: ${n}`,
      cat: "Qarz", date: s, time: "00:00",
      user: window.tgUser, prof: "general",
    });
  }

  window.setVal("debt-name", "");
  window.el("debt-amount").value = "";
  window.save();
  window.toast("Saqlandi!");
};

window.closeDebt = id => {
  window.initCloseActionOld(() => {
    const d = window.state.debts.find(x => x.id == id);
    if (!d) return;
    const today = new Date().toISOString().slice(0, 10);
    if (d.type === "take") {
      window.state.incs.unshift({
        id: Date.now(), amount: d.amount, desc: `Qarz qaytdi: ${d.name}`,
        cat: "Qarz", date: today, time: "00:00",
        user: window.tgUser, prof: "general",
      });
    } else {
      window.state.txs.unshift({
        id: Date.now(), amount: d.amount, desc: `Qarz to'landi: ${d.name}`,
        cat: "Qarz", date: today, time: "00:00",
        user: window.tgUser, prof: "general",
      });
    }
    d.archived = true;
    d.closeDate = today;
    window.save();
    window.toast("Qarz yopildi ✅");
  });
};

window.permDelDebt = id => {
  window.state.debts = window.state.debts.filter(x => x.id != id);
  window.save();
  window.toast("O'chirildi!");
};
