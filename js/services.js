// ==========================================
// MARKET TABS — Bozorlik bo'limi 4 ta tab
// ==========================================

// ── Tab tizimini inject qilish ────────────────────────────────────────────────

(function injectMarketTabStyles() {
  if (document.getElementById("_mkt-tab-styles")) return;
  const s = document.createElement("style");
  s.id = "_mkt-tab-styles";
  s.textContent = `
/* ── Tab wrapper ─────────────────────────────────── */
.mkt-tabs-wrapper {
  display: flex;
  gap: 6px;
  padding: 4px;
  background: var(--bg-card, #1e1e2e);
  border-radius: 16px;
  border: 1.5px solid var(--border-color, #2a2a3e);
  margin-bottom: 20px;
  overflow-x: auto;
  scrollbar-width: none;
}
.mkt-tabs-wrapper::-webkit-scrollbar { display: none; }

/* ── Har bir tab tugmasi ─────────────────────────── */
.mkt-tab-btn {
  flex: 1;
  min-width: 72px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 10px 8px;
  border-radius: 12px;
  border: none;
  background: transparent;
  color: var(--text-muted, #888);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .3px;
  cursor: pointer;
  transition: background .2s, color .2s, transform .12s, box-shadow .2s;
  position: relative;
  white-space: nowrap;
  overflow: hidden;
}
.mkt-tab-btn .mkt-tab-icon {
  font-size: 18px;
  line-height: 1;
  transition: transform .2s;
}
.mkt-tab-btn:hover {
  background: var(--bg-hover, #252538);
  color: var(--text, #e0e0e0);
}
.mkt-tab-btn:hover .mkt-tab-icon { transform: scale(1.15) translateY(-1px); }
.mkt-tab-btn:active { transform: scale(.93); }

/* ── Faol tab ────────────────────────────────────── */
.mkt-tab-btn.active {
  background: var(--primary, #7c5cff);
  color: #fff;
  box-shadow: 0 4px 16px rgba(124,92,255,.35);
}
.mkt-tab-btn.active .mkt-tab-icon { transform: scale(1.1); }

/* Tab-1: Ro'yxat tuzish — yashil */
.mkt-tab-btn[data-tab="compose"].active {
  background: linear-gradient(135deg, #4caf7d, #36896a);
  box-shadow: 0 4px 16px rgba(76,175,125,.35);
}
/* Tab-2: Bozorlik ro'yxati — asosiy rang */
.mkt-tab-btn[data-tab="list"].active {
  background: linear-gradient(135deg, #7c5cff, #5a3fdb);
  box-shadow: 0 4px 16px rgba(124,92,255,.35);
}
/* Tab-3: O'tkazib yuborilganlar — sariq */
.mkt-tab-btn[data-tab="skipped"].active {
  background: linear-gradient(135deg, #f0a500, #d4880a);
  box-shadow: 0 4px 16px rgba(240,165,0,.35);
}
/* Tab-4: Xarid qilinganlar — ko'k */
.mkt-tab-btn[data-tab="bought"].active {
  background: linear-gradient(135deg, #2196f3, #1565c0);
  box-shadow: 0 4px 16px rgba(33,150,243,.35);
}

/* ── Badge (hisoblagich) ─────────────────────────── */
.mkt-tab-badge {
  position: absolute;
  top: 6px; right: 6px;
  min-width: 16px; height: 16px;
  border-radius: 8px;
  padding: 0 4px;
  background: var(--danger, #e53935);
  color: #fff;
  font-size: 9px;
  font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  line-height: 1;
  opacity: 0;
  transform: scale(.6);
  transition: opacity .2s, transform .2s;
}
.mkt-tab-badge.visible {
  opacity: 1;
  transform: scale(1);
}
.mkt-tab-btn[data-tab="list"] .mkt-tab-badge { background: var(--primary, #7c5cff); }
.mkt-tab-btn[data-tab="skipped"] .mkt-tab-badge { background: #f0a500; }
.mkt-tab-btn[data-tab="bought"] .mkt-tab-badge { background: #2196f3; }

/* ── Tab panel animatsiyasi ──────────────────────── */
.mkt-tab-panel {
  display: none;
  animation: _mkt-fadein .22s ease both;
}
.mkt-tab-panel.active { display: block; }

@keyframes _mkt-fadein {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: none; }
}

/* ── Xarid qilinganlar ro'yxati ──────────────────── */
.bought-item {
  display: flex; align-items: center; gap: 12px;
  padding: 13px 16px; border-radius: 14px;
  background: var(--bg-card, #1e1e2e);
  border: 1.5px solid var(--border-color, #2a2a3e);
  margin-bottom: 8px;
  animation: _svc-slide-in .22s ease both;
  opacity: .75;
}
.bought-item .bought-icon {
  width: 32px; height: 32px; border-radius: 50%;
  background: rgba(33,150,243,.15);
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; flex-shrink: 0;
  color: #2196f3;
}
.bought-name { font-weight: 700; font-size: 13px; color: var(--text, #e0e0e0); }
.bought-meta { font-size: 11px; color: var(--text-muted, #888); margin-top: 3px; }
.bought-price {
  font-weight: 800; font-size: 13px;
  color: #2196f3; white-space: nowrap;
}

/* ── Skipped (O'tkazib yuborilganlar) ────────────── */
.skipped-item {
  display: flex; align-items: center; gap: 12px;
  padding: 13px 16px; border-radius: 14px;
  background: rgba(240,165,0,.07);
  border: 1.5px solid rgba(240,165,0,.22);
  margin-bottom: 8px;
  animation: _svc-slide-in .22s ease both;
}
.skipped-icon {
  font-size: 20px; flex-shrink: 0;
}
.skipped-name { font-weight: 700; font-size: 13px; color: var(--text, #e0e0e0); }
.skipped-meta { font-size: 11px; color: #f0a500; margin-top: 3px; }

.skipped-unblock-btn {
  background: rgba(240,165,0,.15);
  border: 1.5px solid rgba(240,165,0,.4);
  color: #f0a500;
  border-radius: 9px;
  padding: 6px 12px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  flex-shrink: 0;
  transition: background .15s, transform .1s;
}
.skipped-unblock-btn:hover { background: rgba(240,165,0,.28); }
.skipped-unblock-btn:active { transform: scale(.93); }

/* ── Bo'sh holat ─────────────────────────────────── */
.mkt-empty {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 38px 0; gap: 8px;
  color: var(--text-muted, #888);
}
.mkt-empty .mkt-empty-icon { font-size: 38px; opacity: .5; }
.mkt-empty .mkt-empty-text { font-size: 13px; text-align: center; }

/* ── Statistika kartasi (xarid qilinganlar tepasida) */
.bought-stats-card {
  display: flex; gap: 10px;
  padding: 14px 16px; border-radius: 14px;
  background: linear-gradient(135deg, rgba(33,150,243,.1), rgba(33,150,243,.04));
  border: 1.5px solid rgba(33,150,243,.2);
  margin-bottom: 16px;
}
.bought-stat {
  flex: 1; text-align: center;
}
.bought-stat-val {
  font-size: 17px; font-weight: 800;
  color: #2196f3;
}
.bought-stat-lbl {
  font-size: 10px; color: var(--text-muted, #888);
  margin-top: 2px; font-weight: 600;
}

/* ── Compose bo'limidagi filter qator ────────────── */
.mkt-filter-row {
  display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap;
}
.mkt-filter-row select {
  flex: 1; min-width: 100px;
}
  `;
  document.head.appendChild(s);
})();

// ── Tab render qilish ─────────────────────────────────────────────────────────

window.renderMarketTabs = () => {
  const container = window.el("market-section-root");
  if (!container) return;

  const active = window._mktActiveTab || "compose";

  container.innerHTML = `
    <!-- TAB NAVIGATSIYA -->
    <div class="mkt-tabs-wrapper">
      ${[
        { key: "compose",  icon: "✏️",  label: "Ro'yxat\ntuzish" },
        { key: "list",     icon: "🛒",  label: "Bozorlik\nro'yxati" },
        { key: "skipped",  icon: "⏸",  label: "O'tkazib\nyuborilgan" },
        { key: "bought",   icon: "✅",  label: "Xarid\nqilingan" },
      ].map(t => `
        <button
          class="mkt-tab-btn${active === t.key ? " active" : ""}"
          data-tab="${t.key}"
          onclick="switchMktTab('${t.key}')"
        >
          <span class="mkt-tab-icon">${t.icon}</span>
          <span>${t.label.replace("\n", "<br>")}</span>
          <span class="mkt-tab-badge" id="mkt-badge-${t.key}"></span>
        </button>
      `).join("")}
    </div>

    <!-- PANEL 1: Ro'yxat tuzish -->
    <div class="mkt-tab-panel${active === "compose" ? " active" : ""}" id="mkt-panel-compose">
      <div class="svc-section">
        <label class="label-text">Kategoriya</label>
        <select id="smart-plan-cat" class="select-input" onchange="updateSmartTags()"></select>
      </div>
      <div class="svc-section">
        <label class="label-text">Ichki kategoriya</label>
        <select id="smart-plan-subcat" class="select-input" onchange="renderSmartTags()"></select>
      </div>
      <div id="smart-tags-container" style="margin-bottom:14px;"></div>
      <div class="svc-section">
        <label class="label-text">Mahsulot nomi</label>
        <input id="plan-name" class="input-field" placeholder="Masalan: Non, Yog', Shakar..." />
      </div>
      <div style="display:flex; gap:10px; margin-bottom:12px;">
        <div style="flex:1;">
          <label class="label-text">Hajmi / miqdori</label>
          <input id="plan-qty" class="input-field" placeholder="1 kg, 2 ta..." />
        </div>
        <div style="flex:1;">
          <label class="label-text">Taxminiy narx</label>
          <input id="plan-price" class="input-field money-input" placeholder="0" type="number" />
        </div>
      </div>
      <div class="svc-section">
        <label class="label-text">Bozor / do'kon</label>
        <select id="plan-market" class="select-input">
          <option value="Yaqin_Bozor">🏪 Yaqin Bozor</option>
          <option value="Katta_Bozor">🏬 Katta Bozor</option>
          <option value="Supermarket">🛍 Supermarket</option>
          <option value="Onlayn">📦 Onlayn</option>
          <option value="Dona_Do_kon">🏠 Dona Do'kon</option>
        </select>
      </div>
      <button class="btn-primary" onclick="addPlannedItemManual(); switchMktTab('list');">
        ➕ Ro'yxatga qo'shish
      </button>
    </div>

    <!-- PANEL 2: Bozorlik ro'yxati -->
    <div class="mkt-tab-panel${active === "list" ? " active" : ""}" id="mkt-panel-list">
      <div class="mkt-filter-row">
        <select id="filter-cat" class="select-input" onchange="renderPlanned()">
          <option value="all">🏷 Barcha tur</option>
        </select>
        <select id="filter-market" class="select-input" onchange="renderPlanned()">
          <option value="all">📍 Barcha bozor</option>
          <option value="Yaqin_Bozor">Yaqin Bozor</option>
          <option value="Katta_Bozor">Katta Bozor</option>
          <option value="Supermarket">Supermarket</option>
          <option value="Onlayn">Onlayn</option>
        </select>
      </div>
      <div id="planned-list-container"></div>
      <button
        class="btn-primary"
        style="margin-top:12px; background: var(--bg-card); border: 1.5px dashed var(--border-color); color: var(--text-muted);"
        onclick="switchMktTab('compose')"
      >
        ✏️ Yangi mahsulot qo'shish
      </button>
    </div>

    <!-- PANEL 3: O'tkazib yuborilganlar -->
    <div class="mkt-tab-panel${active === "skipped" ? " active" : ""}" id="mkt-panel-skipped">
      <div id="skipped-list-container"></div>
    </div>

    <!-- PANEL 4: Xarid qilinganlar -->
    <div class="mkt-tab-panel${active === "bought" ? " active" : ""}" id="mkt-panel-bought">
      <div class="bought-stats-card" id="bought-stats-card"></div>
      <div id="bought-list-container"></div>
    </div>
  `;

  window.updatePlanCats();
  window.renderPlanned();
  window._renderSkippedList();
  window._renderBoughtList();
  window._updateMktBadges();
};

// ── Tab almashtirish ──────────────────────────────────────────────────────────

window.switchMktTab = key => {
  window._mktActiveTab = key;

  // Tugmalar
  document.querySelectorAll(".mkt-tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === key);
  });

  // Panellar
  document.querySelectorAll(".mkt-tab-panel").forEach(p => {
    p.classList.toggle("active", p.id === `mkt-panel-${key}`);
  });

  // Panel-specific refresh
  if (key === "list")    { window.renderPlanned(); window._updateMktBadges(); }
  if (key === "skipped") { window._renderSkippedList(); window._updateMktBadges(); }
  if (key === "bought")  { window._renderBoughtList(); window._updateMktBadges(); }
};

// ── Badge yangilash ───────────────────────────────────────────────────────────

window._updateMktBadges = () => {
  const today = new Date().toISOString().slice(0, 10);
  const profItems = window.state.plan.filter(
    x => x.prof === window.curProf || window.curProf === "general"
  );

  const counts = {
    list:    profItems.filter(x => !x.archived && x.skip !== today).length,
    skipped: profItems.filter(x => !x.archived && x.skip === today).length,
    bought:  profItems.filter(x =>  x.archived && x.buyDate === today).length,
  };

  Object.entries(counts).forEach(([tab, count]) => {
    const badge = document.getElementById(`mkt-badge-${tab}`);
    if (!badge) return;
    badge.textContent = count > 99 ? "99+" : count;
    badge.classList.toggle("visible", count > 0);
  });
};

// ── O'tkazib yuborilganlar render ─────────────────────────────────────────────

window._renderSkippedList = () => {
  const cont = window.el("skipped-list-container");
  if (!cont) return;
  const today = new Date().toISOString().slice(0, 10);

  const items = window.state.plan.filter(
    x =>
      !x.archived &&
      x.skip === today &&
      (x.prof === window.curProf || window.curProf === "general")
  );

  if (!items.length) {
    cont.innerHTML = `
      <div class="mkt-empty">
        <div class="mkt-empty-icon">⏸</div>
        <div class="mkt-empty-text">Bugun o'tkazib yuborilgan<br>mahsulotlar yo'q</div>
      </div>`;
    return;
  }

  cont.innerHTML = items.map(x => `
    <div class="skipped-item">
      <span class="skipped-icon">⏸</span>
      <div style="flex:1; min-width:0;">
        <div class="skipped-name">${x.text}</div>
        <div class="skipped-meta">⚠️ Bugun o'tkazib yuborildi · ${x.market?.replace(/_/g, " ") || "—"}</div>
      </div>
      <button class="skipped-unblock-btn" onclick="unSkipAndGo(${x.id})">
        ▶ Qaytarish
      </button>
    </div>
  `).join("");
};

// Skipped mahsulotni qaytarish va "Bozorlik ro'yxati" tabiga o'tish
window.unSkipAndGo = id => {
  const item = window.state.plan.find(x => x.id == id);
  if (item) {
    item.skip = null;
    window.save();
    window.toast("Ro'yxatga qaytarildi ✅");
    window.switchMktTab("list");
    window._updateMktBadges();
  }
};

// ── Xarid qilinganlar render ──────────────────────────────────────────────────

window._renderBoughtList = () => {
  const cont = window.el("bought-list-container");
  const statsCont = window.el("bought-stats-card");
  if (!cont) return;

  const items = window.state.plan
    .filter(
      x =>
        x.archived &&
        x.buyPrice &&
        (x.prof === window.curProf || window.curProf === "general")
    )
    .sort((a, b) => (b.buyDate || "").localeCompare(a.buyDate || ""));

  // Statistika
  if (statsCont) {
    const today = new Date().toISOString().slice(0, 10);
    const todayItems = items.filter(x => x.buyDate === today);
    const todaySum = todayItems.reduce((s, x) => s + (x.buyPrice || 0), 0);
    const totalSum  = items.reduce((s, x) => s + (x.buyPrice || 0), 0);

    statsCont.innerHTML = `
      <div class="bought-stat">
        <div class="bought-stat-val">${todayItems.length}</div>
        <div class="bought-stat-lbl">Bugun xarid</div>
      </div>
      <div class="bought-stat">
        <div class="bought-stat-val">${new Intl.NumberFormat("ru-RU").format(todaySum)}</div>
        <div class="bought-stat-lbl">Bugungi so'm</div>
      </div>
      <div class="bought-stat">
        <div class="bought-stat-val">${items.length}</div>
        <div class="bought-stat-lbl">Jami xarid</div>
      </div>
      <div class="bought-stat">
        <div class="bought-stat-val">${new Intl.NumberFormat("ru-RU").format(totalSum)}</div>
        <div class="bought-stat-lbl">Jami so'm</div>
      </div>
    `;
  }

  if (!items.length) {
    cont.innerHTML = `
      <div class="mkt-empty">
        <div class="mkt-empty-icon">🛍</div>
        <div class="mkt-empty-text">Hali xarid qilingan<br>mahsulotlar yo'q</div>
      </div>`;
    return;
  }

  cont.innerHTML = items.map(x => `
    <div class="bought-item">
      <div class="bought-icon">✅</div>
      <div style="flex:1; min-width:0;">
        <div class="bought-name">${x.text}</div>
        <div class="bought-meta">
          📍 ${x.market?.replace(/_/g, " ") || "—"} &nbsp;·&nbsp;
          📅 ${x.buyDate || "—"}
        </div>
      </div>
      <div class="bought-price">${new Intl.NumberFormat("ru-RU").format(x.buyPrice)} so'm</div>
    </div>
  `).join("");
};

// ── Bozorlik bo'limini ochganda chaqiriladi ───────────────────────────────────
// Siz mavjud kod ichida bozorlik bo'limi render qilinadigan joyga
// quyidagini qo'shing:
//
//   window._mktActiveTab = window._mktActiveTab || "compose";
//   window.renderMarketTabs();
//
// va HTML ichida bozorlik content wrapperni:
//   <div id="market-section-root"></div>
