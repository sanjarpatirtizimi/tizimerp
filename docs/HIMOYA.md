# Sanjar Patir — ma’lumotlar bazasi va server himoyasi

Bu hujjat dasturni egalariga topshirish uchun: **nima qo‘yilgan**, **qanday nomlanadi**, **nima uchun kerak**, va **qaysi funksiyalar ishlashda davom etadi**.

Render managed PostgreSQL’da `postgresql.conf` / `pg_hba.conf` ochilmaydi. Himoya **ilova + SQL (trigger, RLS, TLS)** bilan qilingan.

---

## 1. Server ↔ database aloqasi

| Nom | Nima qiladi | Nima uchun |
|-----|-------------|------------|
| **TLS / SSL** (`sslmode=require`) | NestJS va Postgres o‘rtasidagi trafik shifrlanadi | Tarmoqda parol, pechat, haydovchi ma’lumoti ochiq ketmasin |
| **Secret’lar env’da** | `DATABASE_URL`, JWT, webhook, qurilma kaliti git’da yo‘q | Repoga tushsa, hamma o‘qiydi |
| **CORS_ORIGIN** (ixtiyoriy) | Faqat ruxsat etilgan frontend domenidan API chaqiriladi | Begona saytdan API’ga so‘rov ketmasin |

Production’da `DATABASE_URL`da `sslmode` bo‘lmasa, backend o‘zi `sslmode=require` qo‘shadi.

Render Dashboard → Backend → Environment: `CORS_ORIGIN` = frontend URL (masalan `https://....onrender.com`).

---

## 2. Jadval himoyasi (pul va log o‘chirilmasin)

Migratsiya: `20260815190000_db_append_only_security`  
Render start: `npx prisma migrate deploy` — o‘zi qo‘llaniladi.

### Append-only ledger (o‘zgarmas daftar)

**Nomi:** Immutable / append-only ledger  
**Jadval:** `transactions` (haydovchi pechat, avans, mahsulot, qo‘lda tuzatish)

- `DELETE` / `TRUNCATE` — taqiqlangan  
- `amount`, `type`, haydovchi — o‘zgartirib bo‘lmaydi  
- **Pechat yechish ishlaydi:** faqat `redeemedAt`, `redeemedById`, `redeemKind`, `redeemNote` yangilanadi  

**Nima uchun:** pul tarixini o‘chirib, balansni soxtalashtirish mumkin bo‘lmasin.

### Append-only operator kassasi

**Nomi:** Append-only cash float  
**Jadval:** `operator_cash_entries`

- Faqat yangi qator (`INSERT`)  
- O‘chirish / tahrirlash yo‘q  

**Nima uchun:** smena puli, avans, pechat-pul, smen topshirish izi o‘chmasin.  
**Funksiyalar:** o‘ziga pul o‘tkazish, avans, pechat pulga, smen tugatish — hammasi `INSERT`, ishlayveradi.

### Append-only audit log

**Nomi:** Tamper-evident audit log  
**Jadval:** `audit_logs`

- Faqat yozish va o‘qish  
- Staff harakatlari (haydovchi yaratish, avans, tuzatish) o‘chirilmaydi  

**Nima uchun:** “kim nima qildi” ni yashirib bo‘lmasin.

### Recognition log (kelishlar)

**Nomi:** Append-only event log + cheklangan UPDATE  
**Jadval:** `recognition_events`

- Voqeani o‘chirib bo‘lmaydi  
- **Qizil belgi ishlaydi:** faqat flag maydonlari yangilanadi  
- Pechat, cooldown, unmatched yozuvlari saqlanadi  

**Nima uchun:** Face ID tarixini o‘chirib, qayta pechat olish / izni yo‘qotish mumkin bo‘lmasin.

### Row Level Security (RLS) + FORCE

**Nomi:** PostgreSQL Row Level Security (FORCE)  
**Nima qiladi:** hatto jadval egasi ham policy’siz `DELETE` qila olmaydi (superuser bundan mustasno).  
**Nima uchun:** Render’da odatda bitta DB user — alohida “faqat INSERT” user qo‘yilsa, Prisma migrate va haydovchi tahriri sinadi. RLS+trigger shu user bilan ham o‘chirishni to‘xtatadi.

### REVOKE PUBLIC

**Nomi:** Least privilege (PUBLIC)  
**Nima qiladi:** `PUBLIC` rolga jadvallar ochiq emas.  
**Nima uchun:** tasodifiy/yangi ulanish default huquq olmasin.

### pgcrypto

**Nomi:** PostgreSQL `pgcrypto` extension  
**Nima qiladi:** bazada shifrlash funksiyalari yoqilgan (kelajak / DBA).  
**Nima uchun so‘ralgan edi:** `face_id` ni SQL’da shifrlash.  

**Nega yuz ID ni ustunda shifrlamadik:** pechat `employeeNo` = `driver.id` bilan solishtiriladi. Shifrlansa Face ID va agent **mos kelmaydi**, pechat to‘xtaydi. Yuz kaliti o‘rniga qurilma paroli allaqachon dasturda shifrlangan (pastda).

---

## 3. Dastur darajasidagi himoya (allaqachon bor)

| Nom | Qayerda | Nima uchun |
|-----|---------|------------|
| **JWT** (access + refresh) | Staff / haydovchi login | Sessiya: parolsiz API ochilmasin |
| **bcrypt** | User/haydovchi paroli | Bazadan parol o‘qilsa ham ochilmasin |
| **AES-256-GCM** | Face ID ISAPI paroli (`DEVICE_CREDENTIALS_ENC_KEY`) | Qurilma paroli ochiq text bo‘lmasin |
| **Agent kaliti** (SHA-256 hash) | Relay agent | Planshet kaliti bazada ochiq yotmasin |
| **Webhook secret** | Hikvision → backend | Begona odam soxta pechat yubormasin |
| **Advisory lock + burst guard** | Pechat | Bir qarashda ikki pechat / 1→2→1 double stamp |
| **Soft-delete haydovchi** | `drivers.deletedAt` | Tarix (pul, kelish) o‘chmasin, telefon bo‘shasin |

---

## 4. Funksiyalar — buzilmasligi kerak

| Funksiya | Holat |
|----------|--------|
| Haydovchi qo‘shish / tahrir / rasm / Face IDga yozish | Ishlaydi (`drivers` RLS yo‘q) |
| Pechat (Face ID) | Ishlaydi (`INSERT` transaction + recognition) |
| Avans, mahsulot, qo‘lda tuzatish | Ishlaydi (`INSERT`) |
| Pechat yechish | Ishlaydi (ruxsat etilgan `UPDATE`) |
| Operator puli, smen tugatish | Ishlaydi (`INSERT` juft yozuv) |
| Qizil belgi | Ishlaydi (flag `UPDATE`) |
| Operator/mahsulot/reklama CRUD | Ishlaydi |
| Prisma migrate (Render) | Ishlaydi (bir xil DB user) |

---

## 5. Nima qasddan qilinmadi

| Taklif | Nega yo‘q |
|--------|-----------|
| Ilova userida faqat `INSERT/SELECT` (barcha jadvallar) | Haydovchi status, ulash, stock, reklama, pechat yechish `UPDATE` talab qiladi — dastur to‘xtaydi |
| SQL `pgp_sym_encrypt(face_id)` | Pechat va agent mos kelmaydi; kalit SQL logida chiqishi mumkin |
| `pg_hba.conf` | Render boshqaruvidagi Postgres — fayl yo‘q |

---

## 6. Egalar nima qilishi kerak

1. Ushbu o‘zgarishlar **GitHub `tizimerp` `main`** ga push + Render deploy (migrate avtomatik).  
2. Render **backend** env: `CORS_ORIGIN` = frontend manzili.  
3. `DATABASE_URL`ni ochiq chat/git’ga tashlamang.  
4. SuperAdmin parolini seed’dagi `2010` dan **darhol** o‘zgartiring.  
5. `DEVICE_CREDENTIALS_ENC_KEY` va JWT secret’lar har muhitda alohida bo‘lsin.

Tekshiruv (deploydan keyin, ixtiyoriy, DBeaver):

```sql
-- Kutilgan: xato "append-only"
DELETE FROM audit_logs WHERE false;
DELETE FROM transactions WHERE false;
```
