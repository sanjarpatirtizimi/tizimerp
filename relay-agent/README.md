# Sanjar Patir — Relay Agent

Bu — Face ID qurilmasi bilan **bir xil Wi-Fi/LAN tarmog'ida** turgan planshet yoki
kompyuterga o'rnatiladigan kichik fon dasturi. U doim ishlab turadi va quyidagini
avtomatik bajaradi:

1. Har 1.5 soniyada Sanjar Patir serveridan "yangi qo'shilgan haydovchilar bormi?"
   deb so'raydi.
2. Topilgan har bir haydovchi uchun uning rasmini serverdan yuklab oladi.
3. Rasmni **to'g'ridan-to'g'ri, mahalliy tarmoq orqali** (internet orqali emas)
   Face ID qurilmasiga yozadi.
4. Natijani (muvaffaqiyatli/xato) serverga qaytarib beradi.

Bu jarayonda operator hech narsaga qo'l tegizmaydi — ilovada haydovchi qo'shilgach,
1-2 soniya ichida u avtomatik qurilmaga yoziladi.

## O'rnatish (bir marta)

1. **Node.js** o'rnating (agar hali yo'q bo'lsa): https://nodejs.org — "LTS" versiyani
   yuklab, oddiy "Next, Next, Finish" bilan o'rnating.
2. Bu papkani (`relay-agent`) planshet/kompyuterga nusxalang.
3. Buyruqlar oynasini (Command Prompt / PowerShell) shu papkada oching va bir marta
   ishga tushiring:
   ```
   npm install
   ```
4. `.env.example` faylidan nusxa olib, nomini `.env` ga o'zgartiring va quyidagilarni
   to'ldiring:
   - `API_BASE_URL` — Sanjar Patir backend manzili (o'zgartirmasangiz ham bo'ladi,
     standart qiymat allaqachon to'g'ri).
   - `DEVICE_ID` va `AGENT_KEY` — ilovada **Qurilmalar** sahifasida shu qurilma
     qatorida "Agent ulash" tugmasini bosib oling (kalit faqat bir marta ko'rsatiladi!).
   - `DEVICE_IP`, `DEVICE_PORT` — qurilmaning shu tarmoqdagi IP-manzili (qurilma
     ekranidan yoki router sozlamalaridan ko'rish mumkin).
   - `DEVICE_USERNAME`, `DEVICE_PASSWORD` — qurilmaning admin login/paroli (odatda
     qurilmani birinchi sozlaganda o'rnatilgan).

## Ishga tushirish

Buyruqlar oynasida:
```
npm start
```

Ekranda har bir haydovchi uchun "✔ ... qurilmaga muvaffaqiyatli yozildi" yoki xato
xabari ko'rinib turadi. Oynani yopmang — u shu tarzda doim fonda ishlab turishi kerak.

## Doim avtomatik ishlab turishi uchun (tavsiya etiladi)

Planshet/kompyuter qayta yoqilganda dastur o'zi ishga tushishi uchun, Windows'da
**Task Scheduler** orqali sozlash mumkin:

1. Task Scheduler'ni oching → "Create Task"
2. "Triggers" bo'limida "At log on" ni tanlang
3. "Actions" bo'limida:
   - Program/script: `node`
   - Arguments: `index.js`
   - Start in: shu `relay-agent` papkasining to'liq manzili
4. Saqlang.

Shundan keyin planshet yoqilganda dastur avtomatik, ekranda hech narsa ko'rsatmasdan
fonda ishga tushadi.

## Bitta qurilma = bitta agent

Har bir Face ID qurilmasi uchun alohida `.env` sozlamasi (va shu qurilmaning o'z
`DEVICE_ID`/`AGENT_KEY`i) kerak. Agar bitta planshetda bir nechta qurilmani boshqarish
kerak bo'lsa, shu papkadan bir nechta nusxa oling, har birida alohida `.env` bilan,
va har birini alohida ishga tushiring.
