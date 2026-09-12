# Sanjar Patir — Relay Agent

Bu — Face ID qurilmasi bilan **bir xil Wi-Fi/LAN tarmog'ida** turgan planshet yoki
kompyuterga o'rnatiladigan kichik fon dasturi. U doim ishlab turadi va quyidagini
avtomatik bajaradi:

1. **Yuz yuklash** — serverdan yangi haydovchi rasmini olib Face IDga yozadi.
2. **Pechat** — Face IDdan kelish voqealarini o'qib serverga yuboradi.

---

## O'rnatish (bir marta, 3 qadam)

### 1-qadam — Node.js o'rnating
[https://nodejs.org](https://nodejs.org) → **LTS** → yuklab o'rnating.

### 2-qadam — .env faylini to'ldiring
`.env.example` faylini `.env` nomiga o'zgartiring va quyidagi qatorlarni to'ldiring:

```
API_BASE_URL=https://sizning-server.onrender.com/api
DEVICE_ID=darvoza1
AGENT_KEY=...bu yerga ilova → Qurilmalar → Agent kalitini yozing...
DEVICE_IP=192.168.1.100
DEVICE_PORT=80
DEVICE_USERNAME=admin
DEVICE_PASSWORD=...Face ID paroli...
STAMP_POLL_ENABLED=true
```

### 3-qadam — install.cmd ni ishga tushiring

`install.cmd` faylini **ikki marta bosing**.

> Agar "Administrator sifatida ruxsat" degan oyna chiqsa — **Ha** deng.

**Tayyor!** Endi:
- Kompyuter **har yoqilganda** agent o'zi ishga tushadi — CMD ochish shart emas
- Fon rejimda ishlaydi, oyna ko'rinmaydi
- Loglarni ko'rish: ilovada **Relay agentlar** sahifasiga kiring

---

## Loglarni masofadan ko'rish

Ilova (web) → chapdagi menyu → **Relay agentlar**

U yerda ko'ring:
- Agent onlayn/oflayn holati
- Soddalashtirilgan loglar (emoji bilan — hamma tushunadi)
- Sozlamalarni masofadan o'zgartirish

---

## Qo'shimcha buyruqlar

| Fayl | Nima qiladi |
|------|-------------|
| `install.cmd` | Kompyuter yoqilganda avtomatik ishga tushishni o'rnatadi |
| `uninstall.cmd` | Avtomatik ishga tushishni o'chiradi |
| `start.cmd` | Qo'lda ishga tushiradi (oyna ko'rinadi, loglar ko'rsatiladi) |
| `update.cmd` | Agent fayllarini GitHub dan yangilaydi |

---

## Bitta qurilma = bitta agent papkasi

Har bir Face ID qurilmasi uchun **alohida papka** kerak (masalan `relay-agent` va `relay-agent2`).
Har papkada o'z `.env` fayli bo'lishi kerak (`DEVICE_ID`, `AGENT_KEY`, `DEVICE_IP` boshqacha).

---

## Xatolar

| Xabar | Ma'nosi | Yechim |
|-------|---------|--------|
| `AGENT_KEY noto'g'ri` | Kalit noto'g'ri yoki eskirgan | Ilova → Qurilmalar → Agent kaliti → Yangilash |
| `Face ID javob bermadi` | Qurilma bilan aloqa yo'q | IP to'g'riligini, bir Wi-Fi da ekanini tekshiring |
| `PicFeaturePoints` | Rasm sifati yetarli emas | Haydovchining aniq yuz rasmini qayta yuklang |
| Agent oflayn (ilova) | Agent ishlamayapti | `start.cmd` yoki kompyuterni qayta yoqing |
