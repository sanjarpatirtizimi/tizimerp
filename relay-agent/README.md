# Sanjar Patir — Relay Agent

Bu — Face ID qurilmasi bilan **bir xil Wi-Fi/LAN tarmog'ida** turgan planshet yoki
kompyuterga o'rnatiladigan kichik fon dasturi. U doim ishlab turadi va quyidagini
avtomatik bajaradi:

## Asosiy vazifalar

1. **Yuz yuklash** — serverdan yangi haydovchi rasmini olib Face IDga yozadi.
2. **Pechat (ishonchli yo'l)** — Face IDdan `AcsEvent` ni mahalliy tarmoqda o'qiydi
   va serverga yuboradi. Internet webhook uzilib qolsa ham pechat yo'qolmaydi;
   server vaqtincha javob bermasa, voqealar `acs-outbox.json` da navbatda saqlanadi.

> Muhim: pechat uchun agent **doim yoqiq** turishi kerak (shu kompyuter/planshet
> Face ID bilan bir Wi‑Fi da).

## O'rnatish (bir marta)

1. **Node.js** o'rnating (LTS): https://nodejs.org
2. `relay-agent` papkasini nusxalang.
3. Shu papkada:
   ```
   npm install
   ```
   (`sharp` kerak — Windows da odatda tayyor binary tushadi. Xato bo'lsa [VC++ Redistributable](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist) ni o'rnating.)
4. `.env.example` → `.env` qilib to'ldiring:
   - `API_BASE_URL` — backend (`.../api`)
   - `DEVICE_ID` + `AGENT_KEY` — ilova → **Qurilmalar** → Agent kaliti
   - `DEVICE_IP`, `DEVICE_PORT`, `DEVICE_USERNAME`, `DEVICE_PASSWORD` — Face ID
   - `STAMP_POLL_ENABLED=true` — pechat poll yoqilgan bo'lsin

## Ishga tushirish

```
npm start
```

Oynani yopmang. Logda ko'rinadi:
- `AcsEvent: N ta yangi yuz voqeasi`
- `✓ pechat: Person ID ...`

## Windows da doim ishlashi

Task Scheduler → At log on → `node index.js`, Start in = `relay-agent` papkasi.

## Haydovchini bog'lash (pechat ishlashi uchun)

1. Face IDda haydovchini qo'shing (Person ID ni eslab qoling, masalan `1`)
2. Dasturda haydovchi → **Qurilma ulash** → shu qurilma + Person ID → **Saqlash**
3. Haydovchi **FAOL** bo'lishi kerak
4. Agent ishlab turganda Face IDga qarasa pechat yoziladi

## Bitta qurilma = bitta agent

Har Face ID uchun alohida `.env` (o'z `DEVICE_ID` / `AGENT_KEY` / IP).
**Bitta qurilmaga ikkita `npm start` oynasi ochmang** — agent o'zi qulflaydi.

## Xatolar

- Chrome da `http://192.168.x.x` ochilishi faqat qurilma yoniqligini bildiradi. Face yuklash boshqa API (`/ISAPI/...`). Chrome ishlasa ham `PicFeaturePoints` chiqishi mumkin.
- `connect ECONNREFUSED` yoki `timeout of 8000ms` — PC Face ID bilan bir Wi‑Fi da emas, IP eskirgan, yoki qurilma sekin. Brauzerda sahifa ochilsa, IP odatda to'g'ri.
- `PicFeaturePoints` / `SubpicAnalysisModelingError` — Face ID rasmni qabul qildi, lekin yuz nuqtalarini chiqara olmadi. Agent **1.1.0** rasmlarni **4:2:0 JPEG** qilib yuboradi (eski Jimp 4:4:4 qilib yuborardi). Ishga tushganda logda `Versiya 1.1.0` bo'lishi shart. `rasm: ... (Face ID uchun)` — bu eski kod, yangilang.
- `HTTP 400 Invalid Content` — rasm formati yoki yuz modellashtirish xatosi; logdagi `statusString` / `errorMsg` ga qarang.
