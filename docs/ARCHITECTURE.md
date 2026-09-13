# Tizim arxitekturasi

Quyidagi sxema hozir productionda ishlayotgan arxitekturani ko‘rsatadi. U
microservice emas: asosiy biznes domenlari bitta NestJS ilovasi va bitta
PostgreSQL ma'lumotlar bazasida ishlaydigan modul monolit tarkibida.

![Driver Loyalty ERP arxitekturasi](system-architecture.svg)

## Asosiy oqimlar

1. Operator va haydovchi web ilovaga kiradi; frontend barcha API so‘rovlarini
   NestJS backendning `/api` endpointlariga yuboradi.
2. Backend JWT token turini (`staff` yoki `driver`) va rolni tekshiradi.
   Staff ruxsatlari `SUPER_ADMIN` va `OPERATOR` rollariga bo‘linadi.
3. Ledger, audit, haydovchi, mahsulot va qurilma modullari yagona PostgreSQL
   bazasiga yozadi. Moliyaviy yozuvlar append-only tamoyilida saqlanadi.
4. Hikvision qurilmasidan kelgan recognition webhook backendga keladi. Backend
   anti-fraud cooldownni tekshirib, ledgerga stamp yozadi.
5. Lokal tarmoqdagi relay-agent qurilmalarga Face ID enrollmentni uzatadi va
   agent kaliti bilan backend API orqali sinxronlashadi.

## Xavfsizlik chegaralari

- Public qatlamdan faqat frontend va backend endpointlari ochiq.
- Frontenddan backendga CORS ruxsat etilgan origin bilan cheklanadi.
- Staff va driver JWTlari alohida guardlar orqali ajratilgan.
- Staff parollari bcrypt bilan xeshlanadi; Hikvision credentiallari AES-256-GCM
  bilan shifrlanadi.
- Hikvision webhook imzosi va relay-agent kaliti serverda tekshiriladi.
- PostgreSQL RLS, `REVOKE PUBLIC` va append-only audit/ledger yozuvlari bilan
  himoyalangan.

## Deploy

GitHubga push qilinganda Render frontend va backendni avtomatik deploy qiladi.
Backend deploy vaqtida Prisma migrationlari qo‘llanadi. Diagrammada hozircha
Kafka, Kubernetes va alohida API Gateway yo‘q — ular tizimning joriy
arxitekturasiga kirmaydi.
