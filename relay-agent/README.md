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
