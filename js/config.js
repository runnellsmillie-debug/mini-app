// ==========================================
// CONFIG.JS - Ma'lumotlar, Konstanta va Yordamchilar
// ==========================================

window.PLAN_TAGS = {};
window.SUBCAT_ICONS = {
  "Sabzavot_Kokat":"🥬", "Gosht_Tuxum":"🥩", "Meva_Poliz":"🍎", "Baqqollik":"🍚", "Sut_Non":"🥛",
  "Ichimlik":"🥤", "Ziravorlar":"🌿", "Muzlatilgan":"🧊", "Tozalik":"🧼", "Kommunal":"🧾",
  "Ta'mirlash":"🔨", "Mebel":"🛋", "Bog'":"🌱", "Bolalar":"🧸", "Kattalar":"👔", "Aksessuarlar":"👜",
  "Yoqilgi":"⛽", "Ehtiyot_qism":"⚙️", "Sug'urta":"📋", "Maktab":"📓", "Kurslar":"💻",
  "Universitet":"🎓", "Kanselyariya":"📎", "Dori":"💊", "Shifokor":"👨‍⚕️", "Optika":"👓",
  "Sport":"🏋️", "Chaqaloq":"🍼", "Oyinchoq":"🧸", "Bog'cha":"🏫", "Kosmetika":"💄",
  "Salon":"💇", "Mobil":"📱", "Uy_aloqa":"☎️", "Texnika":"💻", "Sayohat":"✈️", "Oila":"🎬",
  "Sport_dam":"⛷", "Katta":"🧊", "Kichik":"☕", "Uy_hayvoni":"🐱", "Qishloq":"🐄",
  "Hujjat":"📄", "Soliq":"💰", "Xayriya":"🤲"
};
window.CAT_COLORS = {
  "Oziq-ovqat":"#FF6B6B", "Uy_Xojalik":"#FBBF24", "Kiyim":"#8B5CF6", "Talim":"#2196F3",
  "Avto":"#607D8B", "Oyinchoq":"#34D399", "Soglik":"#10B981", "Bolalar":"#F472B6",
  "Go'zallik":"#EC4899", "Aloqa":"#6366F1", "Dam_Olish":"#0EA5E9", "Uy_Jihoz":"#A78BFA",
  "Hayvonlar":"#84CC16", "Hujjat_Soliq":"#94A3B8"
};
window.CAT_ICONS = {
  "Oziq-ovqat":"🛒", "Uy_Xojalik":"🏠", "Kiyim":"👕", "Talim":"📚", "Avto":"🚗",
  "Oyinchoq":"🧸", "Soglik":"💊", "Bolalar":"👶", "Go'zallik":"💄", "Aloqa":"📱",
  "Dam_Olish":"🏖", "Uy_Jihoz":"🔌", "Hayvonlar":"🐾", "Hujjat_Soliq":"📋",
  "Oziq_ovqat":"🛒"
};

window.CATS_DATA = { general: [], child_m: [], child_f: [], home: [] };
window.INC_SOURCES = [ { label: "Oylik maosh", icon: "💼" }, { label: "IMSOA foyda", icon: "💰" }, { label: "Qo'shimcha", icon: "🎁" } ];

window.GITHUB_BANKS_URL = "https://raw.githubusercontent.com/runnellsmillie-debug/mini-app/main/banks.json";
window.GITHUB_PRODUCTS_URL = "https://raw.githubusercontent.com/runnellsmillie-debug/mini-app/main/products.json";
window.GITHUB_DEPS_URL = "https://raw.githubusercontent.com/runnellsmillie-debug/mini-app/main/deposits.json";

window.BANK_DB = {};
window.PRODUCT_DB = {};
window.DEP_DB = {};

window.state = { profiles: [], txs: [], incs: [], debts: [], sched: [], plan: [], deps: [], credits: [] };
window.curProf = "general";
window.curTab = "home";
window.addMode = "expense";
window.amtStr = "";
window.planPriceStr = "";
window.descStr = "";
window.keypadMode = "amount";
window.addExpPanelOpen = false;
window.headerTodayOpen = false;
window.headerNotifOpen = false;
window.serviceEditMode = false;
window.catEditMode = false;
window.catEditLevel = null;
window.catEditParent = null;
window.actMainCat = null; 
window.actSubCat = null;
window.debtType = "take";
window.buyPlanId = null;
window.curDepId = null; 
window.curCreditId = null;
window.sessionData = []; 
window.tgUser = "Siz";
window.confirmActionOld = null;
window.confirmActionYN = null; 
window.tempSchedule = null;

try { if (window.Telegram?.WebApp?.initDataUnsafe?.user) window.tgUser = window.Telegram.WebApp.initDataUnsafe.user.first_name; } catch(e) {}

// DOM Yordamchilari
window.el = id => document.getElementById(id);
window.val = id => window.el(id) ? window.el(id).value : "";
window.setTxt = (id, t) => { if(window.el(id)) window.el(id).innerText = t; };
window.setHtml = (id, h) => { if(window.el(id)) window.el(id).innerHTML = h; };
window.setVal = (id, v) => { if(window.el(id)) window.el(id).value = v; };
window.show = id => { if(window.el(id)) window.el(id).classList.remove('hidden'); };
window.hide = id => { if(window.el(id)) window.el(id).classList.add('hidden'); };

window.formatSpace = (input) => { 
    let v = input.value.replace(/\s+/g, ''); if(v === '') return; 
    v = v.replace(/[^\d.]/g, ''); let p = v.split('.'); 
    p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, " "); input.value = p.join('.'); 
};
window.getNum = (id) => parseFloat(window.val(id).replace(/\s+/g, '')) || 0;
window.formatM = n => {
    const lang = (window.getLang && window.getLang()) || (window.state?.lang) || "uz";
    const loc = lang === "ru" ? "ru-RU" : lang === "en" ? "en-US" : "uz-UZ";
    const cur = window.t ? window.t("currency") : " so'm";
    return new Intl.NumberFormat(loc).format(Math.round(Math.abs(n))) + cur;
};
window.toast = (msg, err=false) => { 
    const t = window.el("toast-msg"); 
    if(t){ t.innerText=msg; t.style.background=err?"var(--danger)":"var(--success)"; t.style.display="block"; setTimeout(()=>t.style.display="none", 2500); } 
};

// LocalStorage'dan saqlash/o'qish
window.save = function() { localStorage.setItem("xarajat_pro_v8", JSON.stringify(window.state)); if(window.render) window.render(); }
window.slugify = text => text.replace(/[^a-zA-Z0-9]/g, '_');

// Tashqi bazani yuklash
window.loadExternalData = async function() {
    try {
        const bRes = await fetch(window.GITHUB_BANKS_URL + "?nocache=" + Date.now());
        if(bRes.ok) { window.BANK_DB = await bRes.json(); localStorage.setItem("banks_db_v1", JSON.stringify(window.BANK_DB)); }
        
        const pRes = await fetch(window.GITHUB_PRODUCTS_URL + "?nocache=" + Date.now());
        if(pRes.ok) { window.PRODUCT_DB = await pRes.json(); localStorage.setItem("products_db_v1", JSON.stringify(window.PRODUCT_DB)); window.buildAdapter(); }
        
        const dRes = await fetch(window.GITHUB_DEPS_URL + "?nocache=" + Date.now());
        if(dRes.ok) { window.DEP_DB = await dRes.json(); localStorage.setItem("deps_db_v1", JSON.stringify(window.DEP_DB)); }
    } catch (error) {
        window.BANK_DB = JSON.parse(localStorage.getItem("banks_db_v1")) || {};
        window.PRODUCT_DB = JSON.parse(localStorage.getItem("products_db_v1")) || {};
        window.DEP_DB = JSON.parse(localStorage.getItem("deps_db_v1")) || {};
        window.buildAdapter();
    }
    if(window.renderBankSelect) window.renderBankSelect();
    if(window.renderDepBankSelect) window.renderDepBankSelect();
};

window.buildAdapter = function() {
    window.PLAN_TAGS = {};
    if(Object.keys(window.PRODUCT_DB).length > 0) {
        for(let cat in window.PRODUCT_DB) { window.PLAN_TAGS[cat] = window.PRODUCT_DB[cat]; }
    }
    window.buildDetailedCategories(); 
    if(window.updatePlanCats) window.updatePlanCats();
};

window.buildDetailedCategories = function() {
    let gen = [];
    Object.keys(window.PLAN_TAGS).forEach(catName => {
        let catItem = {
            id: 'c_'+window.slugify(catName),
            catKey: catName,
            label: window.tCatName ? window.tCatName(catName) : catName.replace(/_/g, ' '),
            icon: window.CAT_ICONS[catName]||"📦",
            color: window.CAT_COLORS[catName]||"#3b82f6",
            subs: []
        };
        Object.keys(window.PLAN_TAGS[catName]).forEach(subName => {
            let items = window.PLAN_TAGS[catName][subName].map(i => {
                let iconMatch = i.match(/^(\p{Extended_Pictographic}|\p{Emoji_Presentation})/u);
                const itemLabelUz = i.replace(/^(\p{Extended_Pictographic}|\p{Emoji_Presentation})\s*/u, '').trim();
                return {
                    id: 'i_'+window.slugify(subName+'_'+itemLabelUz),
                    labelUz: itemLabelUz,
                    label: window.tItemName ? window.tItemName(itemLabelUz) : itemLabelUz,
                    icon: iconMatch ? iconMatch[0] : "▪️"
                };
            });
            catItem.subs.push({
                id: 's_'+window.slugify(subName),
                subKey: subName,
                label: window.tSubcatName ? window.tSubcatName(subName) : subName.replace(/_/g, '/'),
                icon: window.SUBCAT_ICONS[subName]||"📁",
                items: items
            });
        });
        gen.push(catItem);
    });
    gen.push({
        id: "boshqa",
        label: window.tItemName ? window.tItemName("Boshqa Chiqim") : "Boshqa Chiqim",
        labelUz: "Boshqa Chiqim",
        icon: "💸",
        color: "#94A3B8",
        subs: []
    });
    window.CATS_DATA.general = gen;
    window.CATS_DATA.home = gen;
    const childFirst = window.sortCatsForAge ? window.sortCatsForAge(gen, 4) : gen;
    window.CATS_DATA.child_m = childFirst;
    window.CATS_DATA.child_f = childFirst;
    window.CATS_DATA.guest = gen;
    window.CATS_DATA.relative = gen;
};
