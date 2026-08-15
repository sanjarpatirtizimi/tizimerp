/**
 * Production: require TLS between Nest and Postgres (Render managed DB).
 * Must run before PrismaClient is constructed.
 */
const url = process.env.DATABASE_URL;
if (url && process.env.NODE_ENV === 'production' && !/sslmode=/i.test(url)) {
  const sep = url.includes('?') ? '&' : '?';
  process.env.DATABASE_URL = `${url}${sep}sslmode=require`;
}
