import json
import requests
from bs4 import BeautifulSoup
import os

# 1. GitHub'dagi hozirgi banks.json faylini o'qib olish
with open('banks.json', 'r', encoding='utf-8') as f:
    banks_data = json.load(f)

# 2. Saytlardan ma'lumotlarni yig'ish (Scraping)
# DIQQAT: Bu qism har bir bankning rasmiy sayti tuzilishiga qarab yozilishi kerak.
# Quyida Ipak Yo'li banki misolida mantiq ko'rsatilgan:
try:
    print("Ipak Yo'li bankini tekshirish boshlandi...")
    url = "https://uz.ipakyulibank.uz/physical/kredity/avtokredit"
    response = requests.get(url, timeout=10)
    
    # Agar sayt muvaffaqiyatli ochilsa, HTML kodini tahlil qilamiz
    if response.status_code == 200:
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Saytning aynan foiz yozilgan qismini topish (klass nomlari saytga qarab o'zgaradi)
        # rate_element = soup.find('div', class_='credit-rate-class')
        # if rate_element:
        #     yangi_foiz = int(rate_element.text.strip().replace('%', ''))
        #     banks_data["Ipak Yuli Bank"]["credits"][0]["rate"] = yangi_foiz
        #     print(f"Yangi foiz topildi: {yangi_foiz}%")
        
        print("Ipak Yo'li banki tekshirildi.")
except Exception as e:
    print(f"Ipak Yo'li bankini tekshirishda xato: {e}")

# 3. Yangilangan ma'lumotlarni qayta banks.json fayliga yozish
with open('banks.json', 'w', encoding='utf-8') as f:
    json.dump(banks_data, f, ensure_ascii=False, indent=2)

print("Barcha banklar yangilandi va saqlandi!")
