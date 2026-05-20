import json
import requests
from bs4 import BeautifulSoup
import time
import os

# Saytlar bot ekanligimizni sezib to'sib qo'ymasligi uchun soxta brauzer (User-Agent)
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

# 1. BAZANI O'QIB OLISH
def load_db():
    try:
        with open('banks.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Xatolik! banks.json fayli topilmadi yoki xato: {e}")
        return None

# 2. BAZANI SAQLASH
def save_db(data):
    with open('banks.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print("\n💾 Baza muvaffaqiyatli saqlandi!")

# =========================================================
# 3. BANKLARNI AVTOMAT TEKSHIRISH FUNKSIYALARI (Scraping)
# =========================================================

def update_nbu(db):
    print("⏳ NBU tekshirilmoqda...")
    url = "https://nbu.uz/uz/jismoniy-shaxslarga-kreditlar/avtokredit/"
    try:
        res = requests.get(url, headers=HEADERS, timeout=10)
        if res.status_code == 200:
            soup = BeautifulSoup(res.text, 'html.parser')
            # NBU saytida foizlar ko'pincha .percent yoki shunga o'xshash teglarda bo'ladi (Taxminiy)
            rate_box = soup.find('div', class_='info-percent')
            if rate_box:
                # Topilgan matn ichidan faqat raqamni ajratib olish
                rate_text = ''.join(filter(str.isdigit, rate_box.text))
                if rate_text:
                    db["NBU (Milliy Bank)"]["credits"][2]["rate"] = float(rate_text)
                    print(f"✅ NBU Avtokredit yangilandi: {rate_text}%")
            else:
                print("⚠️ NBU: Sayt kodi o'zgargan, raqam topilmadi.")
    except Exception as e:
        print(f"❌ NBU dagi xatolik: {e}")

def update_sqb(db):
    print("⏳ SQB tekshirilmoqda...")
    url = "https://sqb.uz/uz/individuals/credits/mikroqarz/"
    try:
        res = requests.get(url, headers=HEADERS, timeout=10)
        if res.status_code == 200:
            soup = BeautifulSoup(res.text, 'html.parser')
            rate_box = soup.find('div', class_='credit-rate')
            if rate_box:
                rate_text = ''.join(filter(str.isdigit, rate_box.text))
                if rate_text:
                    db["SQB (O'zSQB)"]["credits"][0]["rate"] = float(rate_text)
                    print(f"✅ SQB Mikroqarz yangilandi: {rate_text}%")
            else:
                print("⚠️ SQB: Sayt kodi o'zgargan, raqam topilmadi.")
    except Exception as e:
        print(f"❌ SQB dagi xatolik: {e}")

def update_ipak_yuli(db):
    print("⏳ Ipak Yo'li tekshirilmoqda...")
    url = "https://uz.ipakyulibank.uz/physical/kredity/avtokredit"
    try:
        res = requests.get(url, headers=HEADERS, timeout=10)
        if res.status_code == 200:
            soup = BeautifulSoup(res.text, 'html.parser')
            rate_box = soup.find('span', class_='val')
            if rate_box:
                rate_text = ''.join(filter(str.isdigit, rate_box.text))
                if rate_text:
                    db["Ipak Yuli Bank"]["credits"][1]["rate"] = float(rate_text)
                    print(f"✅ Ipak Yo'li Avtokredit yangilandi: {rate_text}%")
            else:
                print("⚠️ Ipak Yo'li: HTML o'zgargan.")
    except Exception as e:
        print(f"❌ Ipak Yo'li dagi xatolik: {e}")

# KELAJAKDA QO'SHILADIGAN BANKLAR UCHUN QOLIIPLAR:
def update_kapitalbank(db):
    # Bu yerga Kapitalbank logikasi yoziladi
    pass

def update_asakabank(db):
    # Bu yerga Asakabank logikasi yoziladi
    pass

def update_agrobank(db):
    # Bu yerga Agrobank logikasi yoziladi
    pass


# =========================================================
# 4. ASOSIY ISHGA TUSHIRISH QISMI
# =========================================================
if __name__ == "__main__":
    print("🚀 Bank ma'lumotlarini yangilash boti ishga tushdi!\n")
    
    banks_db = load_db()
    
    if banks_db:
        # Funksiyalarni birma-bir chaqiramiz. 
        # Serverni to'ldirib yubormaslik uchun ozgina kutish vaqti (sleep) qo'shamiz
        update_nbu(banks_db)
        time.sleep(2)
        
        update_sqb(banks_db)
        time.sleep(2)
        
        update_ipak_yuli(banks_db)
        time.sleep(2)
        
        # Kelajakda tayyor bo'lsa, qolgan funksiyalarni ham shu yerda chaqirasiz
        # update_kapitalbank(banks_db)
        # update_asakabank(banks_db)
        
        save_db(banks_db)
