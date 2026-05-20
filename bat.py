import asyncio
import logging
import json
import os
import threading
import sqlite3
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import CommandStart
from aiogram.types import WebAppInfo, ReplyKeyboardMarkup, KeyboardButton
from flask import Flask

# 1. Konfiguratsiya
TOKEN = os.getenv("BOT_TOKEN") 
WEB_APP_URL = "https://runnellsmillie-debug.github.io/mini-app/"

# 2. Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- BAZA QISMI ---
def init_db():
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    cursor.execute('''CREATE TABLE IF NOT EXISTS users 
                      (user_id INTEGER PRIMARY KEY, 
                       phone TEXT, 
                       ozi_yaratgan_budget_id INTEGER, 
                       taklif_budget_id INTEGER, 
                       joriy_budget_id INTEGER)''')
    
    cursor.execute('''CREATE TABLE IF NOT EXISTS budgets 
                      (budget_id INTEGER PRIMARY KEY AUTOINCREMENT, balance REAL DEFAULT 0)''')
    
    cursor.execute('''CREATE TABLE IF NOT EXISTS invitations 
                      (from_user_id INTEGER, to_phone TEXT, budget_id INTEGER)''')
    conn.commit()
    conn.close()

def register_user(user_id):
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    cursor.execute("SELECT user_id FROM users WHERE user_id = ?", (user_id,))
    if not cursor.fetchone():
        cursor.execute("INSERT INTO budgets (balance) VALUES (0)")
        shaxsiy_budget = cursor.lastrowid
        cursor.execute("INSERT INTO users VALUES (?, NULL, ?, NULL, ?)", (user_id, shaxsiy_budget, shaxsiy_budget))
        conn.commit()
    conn.close()

init_db()

# 3. Flask serveri
app = Flask(__name__)
@app.route('/')
def health_check(): return "Bot is active!", 200

def run_flask():
    port = int(os.environ.get("PORT", 10000))
    app.run(host='0.0.0.0', port=port)

# 4. Bot qismi
bot = Bot(token=TOKEN)
dp = Dispatcher()

# Bosh menyu klaviaturasi
def get_main_menu():
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="📱 Ilovani ochish")],
            [KeyboardButton(text="👥 Yangi foydalanuvchi bog'lash"), KeyboardButton(text="📋 Guruh a'zolari")],
            [KeyboardButton(text="🔄 Hisobni almashtirish")]
        ],
        resize_keyboard=True
    )

@dp.message(CommandStart())
async def cmd_start(message: types.Message):
    register_user(message.from_user.id)
    await message.answer(
        f"Salom {message.from_user.first_name}! O'zingiz va oilangiz uchun hisob-kitob botiga xush kelibsiz !!!",
        reply_markup=get_main_menu()
    )

# Yangi foydalanuvchi bog'lash
@dp.message(F.text == "👥 Yangi foydalanuvchi bog'lash")
async def start_binding(message: types.Message):
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    cursor.execute("SELECT phone FROM users WHERE user_id = ?", (message.from_user.id,))
    my_phone = cursor.fetchone()[0]
    conn.close()
    
    if not my_phone:
        await message.answer("Ulanish uchun avval o'z telefon raqamingizni yuboring (Masalan: +998901234567):")
    else:
        await message.answer("Sizning hisobingizga ulanishi kerak bo'lgan oila a'zongizning telefon raqamini yuboring (+998XXXXXXXXX shaklida):")

# Nomer kiritilganda qayta ishlash
@dp.message(F.text.regexp(r'^\+?\d{9,13}$'))
async def handle_phone_input(message: types.Message):
    phone = message.text.replace("+", "")
    user_id = message.from_user.id
    
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    
    cursor.execute("SELECT phone FROM users WHERE user_id = ?", (user_id,))
    my_phone = cursor.fetchone()[0]
    
    if not my_phone:
        cursor.execute("UPDATE users SET phone = ? WHERE user_id = ?", (phone, user_id))
        conn.commit()
        conn.close()
        await message.answer(f"✅ Nomeringiz saqlandi! Endi sherigingizni ulash uchun qaytadan '👥 Yangi foydalanuvchi bog'lash' tugmasini bosing.")
        return

    # O'ziga o'zi yuborayotganini tekshirish (Xatoni oldini olish)
    if phone == my_phone:
        conn.close()
        await message.answer("❌ O'z raqamingizni kiritdingiz! Iltimos, boshqa shaxsning raqamini kiriting.")
        return

    cursor.execute("SELECT user_id, taklif_budget_id FROM users WHERE phone = ?", (phone,))
    target = cursor.fetchone()
    
    if not target:
        conn.close()
        await message.answer("❌ Bu raqam egasi hali botdan ro'yxatdan o'tmagan. Avval u botga kirib /start bosishi va o'z raqamini kiritishi kerak.")
        return
        
    target_user_id, target_taklif = target
    if target_taklif is not None:
        conn.close()
        await message.answer("❌ Bu foydalanuvchida allaqachon taklif orqali bog'langan ikkinchi hisob bor!")
        return

    cursor.execute("SELECT ozi_yaratgan_budget_id FROM users WHERE user_id = ?", (user_id,))
    my_budget = cursor.fetchone()[0]
    
    cursor.execute("DELETE FROM invitations WHERE to_phone = ? AND budget_id = ?", (phone, my_budget))
    cursor.execute("INSERT INTO invitations VALUES (?, ?, ?)", (user_id, phone, my_budget))
    conn.commit()
    conn.close()
    
    inline_kb = types.InlineKeyboardMarkup(inline_keyboard=[
        [
            types.InlineKeyboardButton(text="✅ Ha, tasdiqlayman", callback_data=f"accept_{user_id}"),
            types.InlineKeyboardButton(text="❌ Yo'q", callback_data=f"reject_{user_id}")
        ]
    ])
    
    try:
        await bot.send_message(
            chat_id=target_user_id,
            text=f"🔔 Taklifnoma!\n\nFoydalanuvchi (+{my_phone}) sizni o'zining moliya hisobiga qo'shmoqchi. Birgalikda yuritishni tasdiqlaysizmi?",
            reply_markup=inline_kb
        )
        await message.answer(f"⏳ Taklif (+{phone}) raqamiga yuborildi. U tasdiqlashini kuting.")
    except Exception as e:
        await message.answer("❌ Sherikka xabar yuborishda xatolik yuz berdi.")

# Taklifni tasdiqlash (Tugmalar yo'qolishi bilan ishlaydi)
@dp.callback_query(F.data.startswith("accept_") | F.data.startswith("reject_"))
async def handle_callback(callback: types.CallbackQuery):
    action, from_user_id = callback.data.split("_")
    from_user_id = int(from_user_id)
    target_user_id = callback.from_user.id
    
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    
    cursor.execute("SELECT phone FROM users WHERE user_id = ?", (target_user_id,))
    target_phone = cursor.fetchone()[0]
    
    if action == "accept":
        cursor.execute("SELECT budget_id FROM invitations WHERE from_user_id = ? AND to_phone = ?", (from_user_id, target_phone))
        inv = cursor.fetchone()
        
        if inv:
            shared_budget_id = inv[0]
            cursor.execute("UPDATE users SET taklif_budget_id = ?, joriy_budget_id = ? WHERE user_id = ?", 
                           (shared_budget_id, shared_budget_id, target_user_id))
            cursor.execute("DELETE FROM invitations WHERE to_phone = ?", (target_phone,))
            conn.commit()
            
            await callback.message.edit_text("✅ Siz taklifni qabul qildingiz! Endi sherigingiz bilan bitta hisob-kitobni yuritasiz.")
            await bot.send_message(from_user_id, f"🎉 Tabriklaymiz! +{target_phone} raqam egasi taklifni qabul qildi va hisobingizga qo'shildi.")
        else:
            await callback.message.edit_text("❌ Bu taklif eskirgan yoki bekor qilingan.")
            
    elif action == "reject":
        await callback.message.edit_text("❌ Siz taklifni rad etdingiz.")
        cursor.execute("DELETE FROM invitations WHERE from_user_id = ? AND to_phone = ?", (from_user_id, target_phone))
        conn.commit()
        await bot.send_message(from_user_id, f"❌ +{target_phone} raqam egasi taklifingizni rad etdi.")
        
    conn.close()
    await callback.answer()

# Guruh a'zolarini ko'rish (YANGI QISM)
@dp.message(F.text == "📋 Guruh a'zolari")
async def show_group_members(message: types.Message):
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    
    cursor.execute("SELECT joriy_budget_id FROM users WHERE user_id = ?", (message.from_user.id,))
    joriy = cursor.fetchone()[0]
    
    cursor.execute("SELECT phone, user_id FROM users WHERE ozi_yaratgan_budget_id = ? OR taklif_budget_id = ?", (joriy, joriy))
    members = cursor.fetchall()
    conn.close()
    
    if not members:
        await message.answer("Sizning hozirgi hisobingizda guruh a'zolari topilmadi.")
        return
        
    text = "👥 Hozirgi hisobingiz a'zolari:\n\n"
    for idx, (phone, uid) in enumerate(members, 1):
        me = " (Siz)" if uid == message.from_user.id else ""
        text += f"{idx}. +{phone}{me}\n"
        
    await message.answer(text)

# Hisobni almashtirish
@dp.message(F.text == "🔄 Hisobni almashtirish")
async def switch_account(message: types.Message):
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    cursor.execute("SELECT ozi_yaratgan_budget_id, taklif_budget_id, joriy_budget_id FROM users WHERE user_id = ?", (message.from_user.id,))
    ozi, taklif, joriy = cursor.fetchone()
    
    if not taklif:
        await message.answer("Sizda ikkinchi (oilaviy) hisob mavjud emas. Buning uchun sherik bog'lashingiz kerak.")
        conn.close()
        return
        
    yangi_joriy = taklif if joriy == ozi else ozi
    cursor.execute("UPDATE users SET joriy_budget_id = ? WHERE user_id = ?", (yangi_joriy, message.from_user.id))
    conn.commit()
    conn.close()
    
    turi = "Oilaviy (Umumiy)" if yangi_joriy == taklif else "Shaxsiy"
    await message.answer(f"🔄 Hisob almashtirildi! Joriy rejim: **{turi}**")

# Ilovani ochish
@dp.message(F.text == "📱 Ilovani ochish")
async def open_app_button(message: types.Message):
    web_app = WebAppInfo(url=WEB_APP_URL)
    inline_kb = types.InlineKeyboardMarkup(inline_keyboard=[
        [types.InlineKeyboardButton(text="🚀 Ilovaga kirish", web_app=web_app)]
    ])
    await message.answer("Ilovani ochish uchun quyidagi tugmani bosing:", reply_markup=inline_kb)

# Web App'dan kelgan ma'lumotni qayta ishlash
@dp.message(F.web_app_data)
async def web_app_handler(message: types.Message):
    try:
        data = json.loads(message.web_app_data.data)
        amount = float(data.get("amount", 0))
        action_type = data.get("type", "minus")
        
        conn = sqlite3.connect('bot_data.db')
        cursor = conn.cursor()
        
        cursor.execute("SELECT joriy_budget_id FROM users WHERE user_id = ?", (message.from_user.id,))
        budget_id = cursor.fetchone()[0]
        
        if action_type == "minus":
            cursor.execute("UPDATE budgets SET balance = balance - ? WHERE budget_id = ?", (amount, budget_id))
        else:
            cursor.execute("UPDATE budgets SET balance = balance + ? WHERE budget_id = ?", (amount, budget_id))
            
        cursor.execute("SELECT balance FROM budgets WHERE budget_id = ?", (budget_id,))
        new_balance = cursor.fetchone()[0]
        conn.commit()
        conn.close()
        
        await message.answer(f"✅ Amal bajarildi.\n📊 Guruh/Hisob balansi: {new_balance} UZS")
    except Exception as e:
        logger.error(f"Xato: {e}")
        await message.answer("Ma'lumotni saqlashda xatolik yuz berdi.")

async def main():
    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot)

if __name__ == "__main__":
    flask_thread = threading.Thread(target=run_flask, daemon=True)
    flask_thread.start()
    asyncio.run(main())
