// ==========================================
// I18N — til lug'ati
// ==========================================

window.I18N = {
    uz: {
        profiles: "Profillar",
        settings: "Sozlamalar",
        language: "Til",
        theme: "Rejim",
        theme_light: "Kun",
        theme_dark: "Tun",
        theme_auto: "Avto",
        close: "Yopish",
        profile_quick_ph: "Profil ismi (tez tanlash)...",
        new_profile: "Yangi profil",
        admin_reset: "Dasturni tozalash",
        profile_hint_admin: "Bosing — tanlash · ikonkani ushlab turing — sozlamalar",
        profile_hold_settings: "Ushlab turing — sozlamalar",
        permissions: "Ruxsatlar",
        save_profile: "Profilni saqlash",
        edit_profile: "Profilni tahrirlash",
        perm_tabs: "Pastki menyu",
        perm_services: "Xizmatlar",
        perm_shopping: "Bozorlik toifalari",
        perm_admin: "Admin",
        perm_admin_all: "Barcha huquqlar",
        nav_home: "Asosiy",
        nav_add: "Kiritish",
        nav_other: "Xizmatlar",
        nav_report: "Hisobot",
        balance: "Balans",
        today: "Bugun",
        total_balance: "Jami mavjud mablag'",
        save_exit: "Saqlash va chiqish",
        expense: "Chiqim",
        income: "Kirim",
        desc_ph: "Izoh (ixtiyoriy)...",
        sort_hint: "Ushlab turing — tartiblash rejimi",
        today_expenses: "Bugungi xarajatlar",
        family_expenses: "Oilaviy xarajatlar",
        month_prefix: "Oy:",
        limit_prefix: "Limit:",
        linked_title: "Telegram bog'langan",
        sort_mode: "Tartiblash rejimi",
        ready: "Tayyor",
        keep_one: "Kamida bitta qoldiring!",
        back: "Orqaga",
        rukun: "Rukun:",
        notifications: "Xabarlar"
    },
    ru: {
        profiles: "Профили",
        settings: "Настройки",
        language: "Язык",
        theme: "Режим",
        theme_light: "День",
        theme_dark: "Ночь",
        theme_auto: "Авто",
        close: "Закрыть",
        profile_quick_ph: "Имя профиля (быстрый выбор)...",
        new_profile: "Новый профиль",
        admin_reset: "Очистить приложение",
        profile_hint_admin: "Нажмите — выбрать · удерж. иконку — настройки",
        profile_hold_settings: "Удерж. — настройки",
        permissions: "Разрешения",
        save_profile: "Сохранить профиль",
        edit_profile: "Редактировать профиль",
        perm_tabs: "Нижнее меню",
        perm_services: "Сервисы",
        perm_shopping: "Категории покупок",
        perm_admin: "Админ",
        perm_admin_all: "Все права",
        nav_home: "Главная",
        nav_add: "Ввод",
        nav_other: "Сервисы",
        nav_report: "Отчёт",
        balance: "Баланс",
        today: "Сегодня",
        total_balance: "Всего средств",
        save_exit: "Сохранить и выйти",
        expense: "Расход",
        income: "Доход",
        desc_ph: "Комментарий (необяз.)...",
        sort_hint: "Удерживайте — режим сортировки",
        today_expenses: "Расходы за сегодня",
        family_expenses: "Семейные расходы",
        month_prefix: "Мес:",
        limit_prefix: "Лимит:",
        linked_title: "Привязан Telegram",
        sort_mode: "Режим сортировки",
        ready: "Готово",
        keep_one: "Оставьте хотя бы один!",
        back: "Назад",
        rukun: "Раздел:",
        notifications: "Уведомления"
    },
    en: {
        profiles: "Profiles",
        settings: "Settings",
        language: "Language",
        theme: "Theme",
        theme_light: "Day",
        theme_dark: "Night",
        theme_auto: "Auto",
        close: "Close",
        profile_quick_ph: "Profile name (quick pick)...",
        new_profile: "New profile",
        admin_reset: "Reset app",
        profile_hint_admin: "Tap — select · hold icon — settings",
        profile_hold_settings: "Hold — settings",
        permissions: "Permissions",
        save_profile: "Save profile",
        edit_profile: "Edit profile",
        perm_tabs: "Bottom menu",
        perm_services: "Services",
        perm_shopping: "Shopping categories",
        perm_admin: "Admin",
        perm_admin_all: "All permissions",
        nav_home: "Home",
        nav_add: "Add",
        nav_other: "Services",
        nav_report: "Report",
        balance: "Balance",
        today: "Today",
        total_balance: "Total balance",
        save_exit: "Save and exit",
        expense: "Expense",
        income: "Income",
        desc_ph: "Note (optional)...",
        sort_hint: "Hold — sort mode",
        today_expenses: "Today's expenses",
        family_expenses: "Family expenses",
        month_prefix: "Mo:",
        limit_prefix: "Limit:",
        linked_title: "Linked Telegram",
        sort_mode: "Sort mode",
        ready: "Ready",
        keep_one: "Keep at least one!",
        back: "Back",
        rukun: "Section:",
        notifications: "Notifications"
    }
};

window.t = function(key) {
    const lang = window.state?.lang || "uz";
    return window.I18N[lang]?.[key] ?? window.I18N.uz[key] ?? key;
};

window.applyLang = function() {
    document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.getAttribute("data-i18n");
        if (key) el.textContent = window.t(key);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
        el.placeholder = window.t(el.getAttribute("data-i18n-placeholder"));
    });
    document.querySelectorAll("[data-i18n-title]").forEach(el => {
        el.title = window.t(el.getAttribute("data-i18n-title"));
    });
    document.querySelectorAll("[data-i18n-aria]").forEach(el => {
        el.setAttribute("aria-label", window.t(el.getAttribute("data-i18n-aria")));
    });

    const navMap = { home: "nav_home", add: "nav_add", other: "nav_other", report: "nav_report" };
    Object.keys(navMap).forEach(id => {
        const nav = document.getElementById("nav-" + id);
        const span = nav?.querySelector("span");
        if (span) span.textContent = window.t(navMap[id]);
    });

    const modeExp = document.getElementById("mode-exp");
    const modeInc = document.getElementById("mode-inc");
    if (modeExp) modeExp.textContent = window.t("expense");
    if (modeInc) modeInc.textContent = window.t("income");

    const saveExitBtn = document.querySelector("#tab-home .btn-success");
    if (saveExitBtn) {
        const cnt = document.getElementById("session-count");
        const n = cnt ? cnt.textContent : "0";
        saveExitBtn.innerHTML = `✅ ${window.t("save_exit")} (<span id="session-count">${n}</span>)`;
    }

    if (window.syncSettingsUI) window.syncSettingsUI();
    if (window.renderSidebar) window.renderSidebar();
    if (window.renderAddCats) window.renderAddCats();
    if (window.renderServicesMenu) window.renderServicesMenu();
    if (window.syncDescDisplay && !window.descStr) window.syncDescDisplay();
    const fsModal = document.getElementById("modal-profile-fs");
    if (fsModal?.style.display === "flex" && window.renderProfilePermsGrid) {
        const perms = Array.from(document.querySelectorAll(".fs-perm-chk:checked")).map(c => c.value);
        window.renderProfilePermsGrid(perms);
    }
};
