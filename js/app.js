// ==========================================
// BULUTLI SINXRONIZATSIYA SOZLAMALARI
// ==========================================
const API_BASE = "https://mini-app-gkr9.onrender.com"; // Render manzilingiz
const urlParams = new URLSearchParams(window.location.search);
window.currentBudgetId = urlParams.get('bid'); // Botdan kelgan oilaviy ID

// ==========================================
// ASOSIY HOLAT (STATE)
// ==========================================
window.state = {
    txs: [],       // Barcha tranzaksiyalar (Kirim/Chiqim)
    plan: [],      // Bozorlik va rejali xaridlar
    sched: [],     // Muddatli to'lovlar
    debts: [],     // Qarzlar
    incs: [],      // Foyda/Kirimlar arxivlangan ro'yxati
    profiles: []   // Oila a'zolari profillari
};

// ==========================================
// BULUTDAN YUKLASH (INIT)
// ==========================================
async function initCloudData() {
    if (window.currentBudgetId) {
        try {
            // Serverdan so'raymiz
            let res = await fetch(`${API_BASE}/api/state/${window.currentBudgetId}`);
            let json = await res.json();
            
            if (json.status === "ok" && Object.keys(json.data).length > 0) {
                // Agar eski versiyada ba'zi ro'yxatlar bo'lmasa, ularni yaratib qo'shamiz
                window.state = { ...window.state, ...json.data };
                console.log("Ma'lumotlar bulutdan muvaffaqiyatli yuklandi.");
            } else {
                loadLocalFallback(); // Serverda bo'sh bo'lsa, xotiradan olamiz
            }
        } catch (e) {
            console.error("Bulutga ulanib bo'lmadi:", e);
            loadLocalFallback();
        }
    } else {
        loadLocalFallback();
    }
    
    // Interfeysni yangilash
    if(typeof window.updatePlanCats === 'function') window.updatePlanCats();
    if(typeof window.updateUI === 'function') window.updateUI();
}

function loadLocalFallback() {
    const saved = localStorage.getItem('family_erp_state');
    if (saved) {
        window.state = JSON.parse(saved);
    }
}

// ==========================================
// BULUTGA SAQLASH (SAVE)
// ==========================================
window.save = function(force = false) {
    // 1. Zaxira uchun avval telefonga saqlaymiz (Oflayn ishlash uchun)
    localStorage.setItem('family_erp_state', JSON.stringify(window.state));
    
    // 2. BULUTGA SAQLAYMIZ
    if (window.currentBudgetId) {
        fetch(`${API_BASE}/api/state/${window.currentBudgetId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(window.state)
        }).catch(err => console.error("Bulutga saqlashda xatolik:", err));
    }
    
    if (!force && typeof window.updateUI === 'function') {
        window.updateUI();
    }
};

// ==========================================
// DASTURNI "0" GA TUSHIRISH (RESET)
// ==========================================
window.resetAppData = function() {
    if(confirm("Barcha xarajatlar va tarix o'chib ketadi. Dastur toza 0 holatiga qaytadi. Ishonchingiz komilmi?")) {
        // Mahalliy xotirani tozalash
        localStorage.removeItem('family_erp_state');
        
        // Bo'sh state yasash
        window.state = { txs: [], plan: [], sched: [], debts: [], incs: [], profiles: [] };
        
        // Bulutni ham bo'shatish
        window.save(true);
        
        alert("Barcha ma'lumotlar tozalandi!");
        window.location.reload();
    }
};

// ==========================================
// TELEGRAM YOPILGANDA SAQLASH
// ==========================================
window.saveAndExit = function() {
    window.save(true);
    if (window.Telegram && window.Telegram.WebApp) {
        // Qisqa xabar botga yuboriladi
        window.Telegram.WebApp.sendData(JSON.stringify([{ type: "sync", amount: 0 }]));
        setTimeout(() => window.Telegram.WebApp.close(), 500);
    }
};

// Dastur to'liq yuklanganda bulutni ishga tushirish
document.addEventListener("DOMContentLoaded", () => {
    initCloudData();
    
    if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.expand();
    }
});
