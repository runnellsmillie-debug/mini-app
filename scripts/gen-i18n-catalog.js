const fs = require("fs");
const path = require("path");
const products = JSON.parse(fs.readFileSync(path.join(__dirname, "../products.json"), "utf8"));

const catRu = {
  "Oziq-ovqat": "Продукты питания",
  "Uy_Xojalik": "Дом и быт",
  "Kiyim": "Одежда",
  "Avto": "Авто",
  "Talim": "Образование",
  "Soglik": "Здоровье",
  "Bolalar": "Дети",
  "Go'zallik": "Красота",
  "Aloqa": "Связь и техника",
  "Dam_Olish": "Отдых",
  "Uy_Jihoz": "Бытовая техника",
  "Hayvonlar": "Животные",
  "Hujjat_Soliq": "Документы и налоги"
};
const catEn = {
  "Oziq-ovqat": "Groceries",
  "Uy_Xojalik": "Home & household",
  "Kiyim": "Clothing",
  "Avto": "Automotive",
  "Talim": "Education",
  "Soglik": "Health",
  "Bolalar": "Children",
  "Go'zallik": "Beauty",
  "Aloqa": "Communications",
  "Dam_Olish": "Leisure",
  "Uy_Jihoz": "Home appliances",
  "Hayvonlar": "Pets & farm",
  "Hujjat_Soliq": "Documents & tax"
};

const subRu = {
  Sabzavot_Kokat: "Овощи и зелень",
  Gosht_Tuxum: "Мясо и яйца",
  Meva_Poliz: "Фрукты и бахча",
  Baqqollik: "Бакалея",
  Sut_Non: "Молочное и хлеб",
  Ichimlik: "Напитки",
  Ziravorlar: "Специи",
  Muzlatilgan: "Заморозка",
  Tozalik: "Бытовая химия",
  Kommunal: "Коммунальные",
  "Ta'mirlash": "Ремонт",
  Mebel: "Мебель",
  "Bog'": "Сад",
  Kattalar: "Взрослые",
  Bolalar: "Детская одежда",
  Aksessuarlar: "Аксессуары",
  Yoqilgi: "Топливо",
  Ehtiyot_qism: "Запчасти",
  "Sug'urta": "Страхование",
  Maktab: "Школа",
  Kurslar: "Курсы",
  Universitet: "Университет",
  Kanselyariya: "Канцтовары",
  Dori: "Лекарства",
  Shifokor: "Врачи",
  Optika: "Оптика",
  Sport: "Спорт",
  Chaqaloq: "Младенцы",
  Oyinchoq: "Игрушки",
  "Bog'cha": "Детский сад",
  Kosmetika: "Косметика",
  Salon: "Салон красоты",
  Mobil: "Мобильная связь",
  Uy_aloqa: "Домашняя связь",
  Texnika: "Электроника",
  Sayohat: "Путешествия",
  Oila: "Семейный досуг",
  Sport_dam: "Спортивный отдых",
  Katta: "Крупная техника",
  Kichik: "Мелкая техника",
  Uy_hayvoni: "Домашние животные",
  Qishloq: "Ферма",
  Hujjat: "Документы",
  Soliq: "Налоги",
  Xayriya: "Благотворительность"
};

const subEn = {
  Sabzavot_Kokat: "Vegetables & greens",
  Gosht_Tuxum: "Meat & eggs",
  Meva_Poliz: "Fruits & melons",
  Baqqollik: "Groceries",
  Sut_Non: "Dairy & bread",
  Ichimlik: "Beverages",
  Ziravorlar: "Spices",
  Muzlatilgan: "Frozen foods",
  Tozalik: "Cleaning",
  Kommunal: "Utilities",
  "Ta'mirlash": "Repairs",
  Mebel: "Furniture",
  "Bog'": "Garden",
  Kattalar: "Adults",
  Bolalar: "Kids wear",
  Aksessuarlar: "Accessories",
  Yoqilgi: "Fuel",
  Ehtiyot_qism: "Spare parts",
  "Sug'urta": "Insurance",
  Maktab: "School",
  Kurslar: "Courses",
  Universitet: "University",
  Kanselyariya: "Stationery",
  Dori: "Medicine",
  Shifokor: "Doctors",
  Optika: "Optics",
  Sport: "Sports",
  Chaqaloq: "Baby",
  Oyinchoq: "Toys",
  "Bog'cha": "Kindergarten",
  Kosmetika: "Cosmetics",
  Salon: "Beauty salon",
  Mobil: "Mobile",
  Uy_aloqa: "Home telecom",
  Texnika: "Electronics",
  Sayohat: "Travel",
  Oila: "Family fun",
  Sport_dam: "Sports leisure",
  Katta: "Large appliances",
  Kichik: "Small appliances",
  Uy_hayvoni: "Pets",
  Qishloq: "Farm",
  Hujjat: "Documents",
  Soliq: "Taxes",
  Xayriya: "Charity"
};

// Product translations RU/EN - comprehensive map keyed by Uzbek name (no emoji)
const itemRu = {
  "Pomidor": "Помидор", "Bodring": "Огурец", "Kartoshka": "Картофель", "Piyoz": "Лук",
  "Sabzi": "Морковь", "Ko'katlar": "Зелень", "Qalampir": "Перец", "Sarimsoq": "Чеснок",
  "Baqlajon": "Баклажан", "Brokkoli": "Брокколи", "Bulg'or qalampiri": "Болгарский перец",
  "Karam": "Капуста", "Ukkor": "Укроп", "Batat": "Батат", "Loviya": "Фасоль",
  "No'xat": "Горох", "Salat bargi": "Салатные листья",
  "Mol go'shti": "Говядина", "Qo'y go'shti": "Баранина", "Tovuq": "Курица", "Tuxum": "Яйца",
  "Baliq": "Рыба", "Qiyma": "Фарш", "Ordak": "Утка", "Goshtli assorti": "Мясное ассорти",
  "Kabob uchun": "Для шашлыка", "Kolbasa": "Колбаса", "Sosiska": "Сосиски",
  "Olma": "Яблоко", "Uzum": "Виноград", "Tarvuz": "Арбуз", "Qovun": "Дыня", "Banan": "Банан",
  "Gilos": "Вишня", "Shaftoli": "Персик", "Nok": "Груша", "Apelsin": "Апельсин",
  "Limon": "Лимон", "Kiwi": "Киви", "Anor": "Гранат",
  "Guruch": "Рис", "Makaron": "Макароны", "Tuz": "Соль", "Shakar": "Сахар", "Yog'": "Масло",
  "Tomat pastasi": "Томатная паста", "Mosh": "Маш", "Zaytun moyi": "Оливковое масло",
  "Un": "Мука", "Xamir": "Тесто", "Asal": "Мёд", "Yeryong'oq": "Арахис",
  "Bodom": "Миндаль", "Pechenye": "Печенье", "Shokolad": "Шоколад", "Yorma": "Хлопья",
  "Maku": "Кукуруза", "Lavash": "Лаваш",
  "Non": "Хлеб", "Baton": "Батон", "Sut": "Молоко", "Pishloq": "Сыр", "Sariyog'": "Масло сливочное",
  "Qatiq": "Кефир/йогурт", "Qaymoq": "Сливки", "Margarin": "Маргарин", "Kefir": "Кефир",
  "Tvorog": "Творог", "Baget": "Багет",
  "Choy": "Чай", "Qora choy": "Чёрный чай", "Ko'k choy": "Зелёный чай", "Sharbat": "Сок",
  "Mineral suv": "Минeralная вода", "Kola/Fanta": "Кола/Fanta", "Energetik": "Энергетик",
  "Kakao": "Какао", "Kompot": "Компот", "Qahva": "Кофе",
  "Zira": "Зира", "Rayhon": "Базилик", "Ko'k ziravorlar": "Зелёные специи", "Zanjabil": "Имбирь",
  "Zafar": "Шафран", "Qora murch": "Чёрный перец", "Paprika": "Паприка", "Xmel-suneli": "Хмели-сунели",
  "Muzlatilgan sabzavot": "Замороженные овощи", "Muzlatilgan pizza": "Замороженная пицца",
  "Tovuq nuggets": "Наггетсы", "Muzlatilgan baliq": "Замороженная рыба", "Muzqaymoq": "Мороженое",
  "Pelmen": "Пельмени", "Muzlatilgan no'xat": "Замороженный горох",
  "Sovun": "Мыло", "Idish yuvish geli": "Гель для посуды", "Salfetka": "Салфетки",
  "Kir yuvish kukuni": "Стиральный порошок", "Gubka": "Губка", "Tish pastasi": "Зубная паста",
  "Shampun": "Шампунь", "Gel dush": "Гель для душа", "Tualet qog'ozi": "Туалетная бумага",
  "Axlat paketi": "Мусорные пакеты", "Oqartirgich": "Отбеливатель",
  "Pol yuvish vositasi": "Средство для пола", "Vedro": "Ведро", "Oyna tozalash": "Мойка окон",
  "Elektr toki": "Электричество", "Sovuq suv": "Холодная вода", "Tabiiy gaz": "Газ",
  "Chiqindi": "Вывоз мусора", "Internet (Uzonline)": "Интернет", "Kabel TV": "Кабельное ТВ",
  "Ijara": "Аренда", "Uy-joy xizmati": "ЖКХ", "Lift xizmati": "Лифт",
  "Usta xizmati": "Услуги мастера", "Asbob-uskunalar": "Инструменты",
  "Qurilish materiali": "Стройматериалы", "Bo'yoq": "Краска", "Lampochka": "Лампочка",
  "Elektr detali": "Электрика", "Santexnika": "Сантехника", "Oyna almashtirish": "Замена стекла",
  "Divan": "Диван", "Karavot": "Кровать", "Stul": "Стул", "Shkaf": "Шкаф", "Oyna": "Зеркало",
  "Matras": "Матрас", "Javon": "Полка",
  "Ko'chat": "Саженцы", "O'g'it": "Удобрение", "Sug'orish": "Полив", "Bog' asbobi": "Садовый инвентарь",
  "Gorshoq": "Горшок", "Gul": "Цветы",
  "Ko'ylak": "Рубашка", "Shim": "Брюки", "Poyabzal": "Обувь", "Kurtka": "Куртка",
  "Paypoq": "Носки", "Ayollar kiyimi": "Женская одежда", "Sharf": "Шарф", "Qo'lqop": "Перчатки",
  "Krossovka": "Кроссовки", "Sport kiyim": "Спортивная одежда", "Shortik": "Шорты", "Bosh kiyim": "Головной убор",
  "Mayka": "Майка", "Bolalar shimi": "Детские брюки", "Qishki kiyim": "Зимняя одежда",
  "Chaqaloq kiyimi": "Одежда для младенцев", "Maktab formasi": "Школьная форма",
  "Qiz bolalar kiyimi": "Одежда для девочек",
  "Sumka": "Сумка", "Ko'zoynak": "Очки", "Soat": "Часы", "Zargarlik": "Украшения", "Taqinchoq": "Аксессуар",
  "Benzin (AI-80)": "Бензин AI-80", "Benzin (AI-92)": "Бензин AI-92", "Benzin (AI-95)": "Бензин AI-95",
  "Metan gaz": "Метан", "Propan": "Пропан", "Zaryad (Byd/Jetour)": "Зарядка электро",
  "Motor moyi sarf": "Расход масла", "Yuvish": "Мойка",
  "Motor moyi": "Моторное масло", "Balon": "Шины", "Kolodka": "Колодки", "Avtomoyka": "Автомойка",
  "Akkumulyator": "Аккумулятор", "Far lampochka": "Фара", "Dvigatel filtri": "Фильтр двигателя",
  "Antifriz": "Антифриз", "Diagnostika": "Диагностика",
  "OSAGO": "ОСАГО", "KASKO": "КАСКО", "To'xtash joyi": "Парковка", "Yo'l to'lovi": "Платная дорога",
  "Tex ko'rik": "Техосмотр",
  "Daftar": "Тетрадь", "Ruchka": "Ручка", "Chizg'ich": "Линейка", "Ranets": "Рюкзак",
  "Maktab poyabzali": "Школьная обувь", "Darslik": "Учебник", "Ranglar": "Краски",
  "Geometriya to'plami": "Геометрия", "Kalkulyator": "Калькулятор",
  "IT kurs": "IT курс", "Ingliz tili": "Английский язык", "Musiqa kursi": "Музыка",
  "Sport seksiya": "Спортсекция", "San'at studiyasi": "Студия искусств", "Repetitor": "Репетитор",
  "Suzish": "Плавание", "Robototexnika": "Робототехника",
  "Kontrakt": "Контракт", "O'quv materiali": "Учебные материалы", "Yotoqxona": "Общежитие",
  "Talaba ovqati": "Питание студента", "Noutbuk": "Ноутбук",
  "Skrepka": "Скрепки", "Papka": "Папка", "Printer qog'ozi": "Бумага для принтера",
  "Marker": "Маркер", "Qog'oz": "Бумага",
  "Dorilar": "Лекарства", "Plastir": "Пластырь", "Termometr": "Термометр", "Vitamindlar": "Витамины",
  "Maz": "Мазь", "Shprits": "Шприц",
  "Terapevt": "Терапевт", "Stomatolog": "Стоматолог", "Okulist": "Окулист", "Analiz": "Анализы",
  "Klinika": "Клиника", "Check-up": "Чек-ап",
  "Quyosh ko'zoynagi": "Солнцезащитные очки", "Linza": "Линзы", "Ko'z tomchisi": "Капли для глаз",
  "Sport zal": "Спортзал", "Yoga": "Йога", "Yugurish": "Бег", "Sport inventar": "Спортинвентарь",
  "Sut aralashmasi": "Смесь", "Taglik": "Подгузники", "Idish": "Бутылочка",
  "Chaqaloq kosmetikasi": "Детская косметика", "Chaqaloq o'yinchoq": "Игрушка для младенца",
  "Ayiqcha": "Мишка", "Mashina": "Машинка", "Pazl": "Пазл", "O'yin": "Игра", "Qo'g'irchoq": "Кукла",
  "To'p": "Мяч", "Ranglash": "Раскраска",
  "Bog'cha to'lovi": "Оплата сада", "Bog'cha ovqati": "Питание в саду",
  "Bog'cha sumkasi": "Сумка в сад", "Bog'cha formasi": "Форма для сада",
  "Pomada": "Помада", "Tirnoq": "Маникюр", "Krema": "Крем", "Parfyum": "Парфюм",
  "Tarash": "Расчёска", "Soch bo'yog'i": "Краска для волос",
  "Soch olish": "Стрижка", "Manikyur": "Маникюр", "Kosmetolog": "Косметолог", "Massaj": "Массаж",
  "Soqol xizmati": "Бритьё",
  "Telefon to'lovi": "Оплата телефона", "Internet paket": "Интернет-пакет",
  "Balans to'ldirish": "Пополнение", "Roaming": "Роуминг",
  "Uy telefoni": "Домашний телефон", "Wi-Fi router": "Wi-Fi роутер", "Uy internet": "Домашний интернет",
  "IPTV": "IPTV",
  "Telefon": "Телефон", "Naushnik": "Наушники", "Klaviatura": "Клавиатура", "Sichqoncha": "Мышь",
  "Zaryadchi": "Зарядка",
  "Aviabileti": "Авиабилеты", "Mehmonxona": "Отель", "Taksi": "Такси", "Muzey": "Музей",
  "Ekskursiya": "Экскурсия", "Viza": "Виза",
  "Kino": "Кино", "Park": "Парк", "Restoran": "Ресторан", "Tug'ilgan kun": "День рождения",
  "Sovg'a": "Подарок", "Foto xizmat": "Фотоуслуги",
  "Dam olish bazasi": "База отдыха", "Basseyn": "Бассейн", "Qish sporti": "Зимний спорт", "Piknik": "Пикник",
  "Muzlatgich": "Холодильник", "Pech": "Печь", "Changyutgich": "Пылесос",
  "Kir yuvish mashinasi": "Стиральная машина", "Konditsioner": "Кондиционер",
  "Televizor": "Телевизор", "Gaz plita": "Газовая плита", "Mikroto'lqin": "Микроволновка",
  "Choynak": "Чайник", "Toster": "Тостер", "Uflovchi soch": "Фен", "Multivarka": "Мультиварка",
  "Blender": "Блендер", "Termopot": "Термопот", "Ventilyator": "Вентилятор",
  "Mushuk ovqati": "Корм для кошек", "It ovqati": "Корм для собак", "Baliq ovqati": "Корм для рыб",
  "It o'yinchoq": "Игрушка для собак", "Veterinar": "Ветеринар",
  "Chorva yem": "Корм для скота", "Parranda yem": "Корм для птиц",
  "Sut mahsuloti sotib olish": "Закупка молочки", "Qo'y boqish": "Содержание овец",
  "Pasport xizmati": "Паспортные услуги", "Notarius": "Нотариус", "Davlat boji": "Госпошлина",
  "Shartnoma": "Договор", "ID karta": "ID карта",
  "Daromad solig'i": "Подоходный налог", "Mulk solig'i": "Налог на имущество",
  "Transport solig'i": "Транспортный налог", "Hisobot": "Отчёт",
  "Xayriya": "Благотворительность", "Masjid": "Мечеть", "Cherkov": "Церковь", "Yordam": "Помощь"
};

const itemEn = {};
for (const [k, v] of Object.entries(itemRu)) {
  itemEn[k] = k.replace(/'/g, "'"); // fallback - use transliteration style for en from uz keys where no en
}
// Better EN - copy structure with English names
Object.assign(itemEn, {
  "Pomidor": "Tomato", "Bodring": "Cucumber", "Kartoshka": "Potato", "Piyoz": "Onion",
  "Sabzi": "Carrot", "Ko'katlar": "Greens", "Qalampir": "Pepper", "Sarimsoq": "Garlic",
  "Baqlajon": "Eggplant", "Brokkoli": "Broccoli", "Bulg'or qalampiri": "Bell pepper",
  "Karam": "Cabbage", "Ukkor": "Dill", "Batat": "Sweet potato", "Loviya": "Beans",
  "No'xat": "Peas", "Salat bargi": "Salad leaves",
  "Mol go'shti": "Beef", "Qo'y go'shti": "Lamb", "Tovuq": "Chicken", "Tuxum": "Eggs",
  "Baliq": "Fish", "Qiyma": "Minced meat", "Ordak": "Duck", "Goshtli assorti": "Meat assortment",
  "Kabob uchun": "For kebab", "Kolbasa": "Sausage", "Sosiska": "Frankfurters",
  "Olma": "Apple", "Uzum": "Grapes", "Tarvuz": "Watermelon", "Qovun": "Melon", "Banan": "Banana",
  "Gilos": "Cherry", "Shaftoli": "Peach", "Nok": "Pear", "Apelsin": "Orange",
  "Limon": "Lemon", "Kiwi": "Kiwi", "Anor": "Pomegranate",
  "Guruch": "Rice", "Makaron": "Pasta", "Tuz": "Salt", "Shakar": "Sugar", "Yog'": "Oil",
  "Tomat pastasi": "Tomato paste", "Mosh": "Mung beans", "Zaytun moyi": "Olive oil",
  "Un": "Flour", "Xamir": "Dough", "Asal": "Honey", "Yeryong'oq": "Peanuts",
  "Bodom": "Almonds", "Pechenye": "Cookies", "Shokolad": "Chocolate", "Yorma": "Cereal",
  "Maku": "Corn", "Lavash": "Lavash",
  "Non": "Bread", "Baton": "Loaf", "Sut": "Milk", "Pishloq": "Cheese", "Sariyog'": "Butter",
  "Qatiq": "Yogurt", "Qaymoq": "Cream", "Margarin": "Margarine", "Kefir": "Kefir",
  "Tvorog": "Cottage cheese", "Baget": "Baguette",
  "Choy": "Tea", "Qora choy": "Black tea", "Ko'k choy": "Green tea", "Sharbat": "Juice",
  "Mineral suv": "Mineral water", "Kola/Fanta": "Cola/Fanta", "Energetik": "Energy drink",
  "Kakao": "Cocoa", "Kompot": "Compote", "Qahva": "Coffee",
  "Boshqa Chiqim": "Other expense"
});

itemRu["Boshqa Chiqim"] = "Прочий расход";
itemEn["Boshqa Chiqim"] = "Other expense";

// Auto-fill missing EN from products
function stripEmoji(s) {
  return String(s)
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Emoji}]/gu, "")
    .replace(/[\uFE0F\u200D]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function rekeyItems(map) {
  const out = {};
  for (const [k, v] of Object.entries(map)) {
    const nk = stripEmoji(k);
    if (!nk) continue;
    out[nk] = out[nk] || v;
  }
  return out;
}

const itemsRu = rekeyItems({ ...itemRu });
const itemsEn = rekeyItems({ ...itemEn });
for (const cat of Object.values(products)) {
  for (const items of Object.values(cat)) {
    for (const raw of items) {
      const name = stripEmoji(raw);
      if (!name) continue;
      if (!itemsRu[name]) itemsRu[name] = name;
      if (!itemsEn[name]) itemsEn[name] = name;
    }
  }
}

const out = `// AUTO-GENERATED catalog — do not edit by hand; run: node scripts/gen-i18n-catalog.js
window.I18N_CATALOG = {
  cats: ${JSON.stringify({ ru: catRu, en: catEn }, null, 2)},
  subs: ${JSON.stringify({ ru: subRu, en: subEn }, null, 2)},
  items: ${JSON.stringify({ ru: itemsRu, en: itemsEn }, null, 2)}
};

window.KEYBOARD_LAYOUTS = {
  uz: [
    ["Q","W","E","R","T","Y","U","I","O","P","O'","G'"],
    ["A","S","D","F","G","H","J","K","L"],
    ["Z","X","C","V","B","N","M"]
  ],
  ru: [
    ["Й","Ц","У","К","Е","Н","Г","Ш","Щ","З","Х","Ъ"],
    ["Ф","Ы","В","А","П","Р","О","Л","Д","Ж","Э"],
    ["Я","Ч","С","М","И","Т","Ь","Б","Ю"]
  ],
  en: [
    ["Q","W","E","R","T","Y","U","I","O","P"],
    ["A","S","D","F","G","H","J","K","L"],
    ["Z","X","C","V","B","N","M"]
  ]
};

window.getLang = function() {
  return (window.state && window.state.lang) || "uz";
};

window.tCatName = function(key) {
  const lang = window.getLang();
  if (lang === "uz") return String(key).replace(/_/g, " ");
  return window.I18N_CATALOG.cats[lang]?.[key] || String(key).replace(/_/g, " ");
};

window.tSubcatName = function(key) {
  const lang = window.getLang();
  if (lang === "uz") return String(key).replace(/_/g, "/");
  return window.I18N_CATALOG.subs[lang]?.[key] || String(key).replace(/_/g, "/");
};

window.tItemName = function(label) {
  if (!label) return label;
  const lang = window.getLang();
  if (lang === "uz") return label;
  const clean = String(label).replace(/[\\p{Extended_Pictographic}\\p{Emoji_Presentation}\\p{Emoji}]/gu, "").replace(/[\\uFE0F\\u200D]/g, "").replace(/\\s+/g, " ").trim();
  return window.I18N_CATALOG.items[lang]?.[clean] || window.I18N_CATALOG.items[lang]?.[label] || label;
};

window.tStoredLabel = function(text) {
  if (!text) return text;
  const lang = window.getLang();
  if (lang === "uz") return text;
  const cats = window.I18N_CATALOG?.cats?.[lang] || {};
  for (const [k, v] of Object.entries(cats)) {
    if (k.replace(/_/g, " ") === text) return v;
  }
  const clean = String(text).replace(/[\\p{Extended_Pictographic}\\p{Emoji_Presentation}\\p{Emoji}]/gu, "").replace(/[\\uFE0F\\u200D]/g, "").replace(/\\s+/g, " ").trim();
  return window.I18N_CATALOG?.items?.[lang]?.[clean] || window.I18N_CATALOG?.items?.[lang]?.[text] || text;
};

window.tIncomeSource = function(label) {
  const map = {
    ru: { "Oylik maosh": "Зарплата", "IMSOA foyda": "Прибыль IMSOA", "Qo'shimcha": "Дополнительно" },
    en: { "Oylik maosh": "Salary", "IMSOA foyda": "IMSOA profit", "Qo'shimcha": "Extra" }
  };
  const lang = window.getLang();
  if (lang === "uz") return label;
  return map[lang]?.[label] || label;
};

window.tRoleLabel = function(role) {
  const key = "role_" + role;
  return window.t ? window.t(key) : role;
};
`;

fs.writeFileSync(path.join(__dirname, "../js/i18n-catalog.js"), out, "utf8");
console.log("Written js/i18n-catalog.js", Object.keys(itemsRu).length, "items");
