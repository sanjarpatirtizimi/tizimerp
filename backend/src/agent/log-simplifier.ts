/**
 * Relay agent loglarini soddalashtirib, har kim tushunadigan
 * Uzbek tilidagi xabarga aylantiradi.
 */

interface SimplifiedLog {
  message: string;
  level: 'info' | 'warn' | 'error';
}

export function simplifyLog(raw: string): SimplifiedLog {
  const text = raw.replace(/^\[\d{1,2}:\d{2}:\d{2}\]\s*/, '').trim();

  // ============================================================
  // ISHGA TUSHISH
  // ============================================================
  if (/relay agent ishga tushdi/i.test(text)) {
    return { message: '\u{1F680} Relay agent ishga tushdi', level: 'info' };
  }

  if (/Versiya\s+[\d.]+/i.test(text)) {
    const m = text.match(/Versiya\s+([\d.]+)/i);
    const v = m ? m[1] : '?';
    return { message: `\u2139\uFE0F Agent versiyasi: ${v}`, level: 'info' };
  }

  if (/Server ulandi|Server qurilmani tanidi/i.test(text)) {
    return { message: '\u{1F517} Server bilan ulanish o\'rnatildi', level: 'info' };
  }

  if (/Server:.*http/i.test(text) || /Qurilma.*\.env/i.test(text)) {
    return { message: '\u2139\uFE0F Sozlamalar yuklandi', level: 'info' };
  }

  if (/Haydovchi qo.*shilsa logda/i.test(text) || /Oynani yopmang/i.test(text)) {
    return { message: '\u{1F40C} Tayyor — yangi haydovchi qo\'shilishini kutmoqda', level: 'info' };
  }

  if (/Pechat poll.*o.chirilgan/i.test(text)) {
    return { message: '\u2139\uFE0F Pechat o\'qish o\'chirilgan', level: 'info' };
  }

  if (/Pechat oralig|Pechat poll/i.test(text)) {
    return { message: '\u2139\uFE0F Pechat o\'qish yoqilgan', level: 'info' };
  }

  // ============================================================
  // MUVAFFAQIYATLI HAYDOVCHI YUKLASH
  // ============================================================
  if (/\u2713.*yozildi/i.test(text) || /yozildi.*Person ID/i.test(text)) {
    const m = text.match(/\u2713\s*(.+?)\s+yozildi/i);
    const name = m ? m[1].trim() : 'Haydovchi';
    return { message: `\u2705 "${name}" Face ID ga muvaffaqiyatli yozildi`, level: 'info' };
  }

  if (/yangi haydovchi:/i.test(text)) {
    const m = text.match(/yangi haydovchi:\s*(.+)/i);
    const name = m ? m[1].trim() : '';
    if (name) {
      return { message: `\u{1F464} Yangi haydovchi qo'shilmoqda: ${name}`, level: 'info' };
    }
  }

  if (/haydovchi navbatda.*hozir/i.test(text)) {
    const nameMatch = text.match(/hozir\s+(.+?),/i);
    const name = nameMatch ? nameMatch[1].trim() : '';
    const countMatch = text.match(/(\d+)\s*ta.*navbatda/i);
    const count = countMatch ? countMatch[1] : '?';
    if (name) {
      return { message: `\u{1F464} ${count} ta navbatda — hozir: ${name}`, level: 'info' };
    }
    return { message: `\u{1F464} ${count} ta haydovchi navbatda`, level: 'info' };
  }

  if (/rasm:.*KB.*\u2192/i.test(text)) {
    return { message: '\u{1F4F7} Rasm muvaffaqiyatli tayyorlandi', level: 'info' };
  }

  // ============================================================
  // ISHLAYAPTI (HEARTBEAT)
  // ============================================================
  if (/ishlayapti.*yuz yozilmoqda/i.test(text)) {
    const m = text.match(/navbat[:\s]+(\d+)/i);
    const count = m ? m[1] : '?';
    return { message: `\u23F3 ${count} ta haydovchi navbatda — Face ID ga yozilmoqda`, level: 'info' };
  }

  if (/ishlayapti.*Face ID so.ralmoqda/i.test(text)) {
    const m = text.match(/\((\d+) marta OK\)/);
    const count = m ? m[1] : '';
    return {
      message: count
        ? `\u2705 Ishlayapti — ${count} marta muvaffaqiyatli tekshirildi`
        : '\u2705 Ishlayapti — hamma narsa yaxshi',
      level: 'info',
    };
  }

  if (/ishlayapti.*oxirgi xato/i.test(text)) {
    return { message: '\u26A0\uFE0F Ishlayapti, lekin oxirgi xato bor — loglarni tekshiring', level: 'warn' };
  }

  if (/ishlayapti/i.test(text) && !/xato/i.test(text)) {
    return { message: '\u2705 Ishlayapti — hamma narsa yaxshi', level: 'info' };
  }

  // ============================================================
  // NAVBAT BO'SH
  // ============================================================
  if (/navbat bo.sh/i.test(text)) {
    return {
      message: '\u{1F634} Hozircha hech kim yo\'q — yangi haydovchi qo\'shilsa darhol ishlaydi',
      level: 'info',
    };
  }

  // ============================================================
  // NAVBAT KATTA / TOZALASH
  // ============================================================
  if (/navbat noldan/i.test(text) || /navbat tozalandi/i.test(text)) {
    const m = text.match(/(\d+) ta yuz yuklash/i);
    const count = m ? m[1] : '?';
    return { message: `\u{1F5D1}\uFE0F Navbat tozalandi — ${count} ta eski vazifa o\'chirildi`, level: 'info' };
  }

  if (/navbat katta/i.test(text)) {
    const m = text.match(/navbat katta.*?(\d+) ta/i);
    const count = m ? m[1] : '?';
    return { message: `\u26A0\uFE0F Navbat to\'lib ketdi (${count} ta) — tozalanmoqda`, level: 'warn' };
  }

  if (/kutishda.*Face ID dam oladi/i.test(text)) {
    return { message: '\u23F8\uFE0F Face ID hozir band — bir oz kutilmoqda', level: 'info' };
  }

  // ============================================================
  // ACS EVENT — YUZ SKANLASH (PECHAT)
  // ============================================================
  if (/AcsEvent:.*ta YANGI yuz/i.test(text)) {
    const n = text.match(/(\d+)\s*ta YANGI yuz/i);
    const t = text.match(/\((\d+)\s*jami/i);
    const count = n ? n[1] : '?';
    const total = t ? ` (${t[1]} ta oynada)` : '';
    return { message: `\u{1F6B6} ${count} ta odam yuzini ko\u02BBrsatdi${total}`, level: 'info' };
  }

  if (/\u2713\s*pechat:.*Person ID/i.test(text)) {
    const m = text.match(/Person ID\s*(\S+)\s*\(([^)]*)\)/i);
    const name = m ? m[2].trim() : '';
    const pid = m ? m[1] : '';
    return { message: `\u{1F3AB} Pechat berildi${name ? ': ' + name : ''} (ID: ${pid})`, level: 'info' };
  }

  if (/takroriy.*e.tiborsiz|IGNORED_COOLDOWN/i.test(text)) {
    return { message: '\u{1F504} Takroriy pechat — e\'tiborsiz (bir xil signal)', level: 'info' };
  }

  if (/kutish.*Person ID.*pechat yaqinda/i.test(text)) {
    const wait = text.match(/~([^\s,]+(?:\s+(?:soat|daqiqa|s))?)/);
    return {
      message: `\u23F3 Bu odam yaqinda kelgan — ${wait ? wait[1] : '?'} kutish kerak`,
      level: 'info',
    };
  }

  if (/YANGI serial yo.q.*pechat yuborilmaydi/i.test(text) || /qurilma yuzni ko.rsatishi mumkin/i.test(text)) {
    return { message: '\u{1F441}\uFE0F Yuz ko\u02BBrindi, lekin yangi signal yo\u02BBq — Face ID sozlash kerak', level: 'warn' };
  }

  if (/Pechat navbatini serverga yuborib bo.lmadi/i.test(text)) {
    return { message: '\u{1F310} Pechat serverga yuborilmadi — qayta urinadi', level: 'warn' };
  }

  // ============================================================
  // XATOLAR — FACE ID QURILMASI
  // ============================================================
  if (/Face ID javob bermadi/i.test(text) || /ECONNREFUSED/i.test(text)) {
    return {
      message: '\u{1F534} Face ID qurilmasi javob bermayapti — ulanishni tekshiring',
      level: 'error',
    };
  }

  if (/AcsEvent.*xatosi|pechat xatosi/i.test(text)) {
    const waitMatch = text.match(/(\d+)s dam/);
    const wait = waitMatch ? ` ${waitMatch[1]} soniya` : '';
    return {
      message: `\u26A0\uFE0F Pechat o\'qishda xato — qurilma${wait} dam oladi`,
      level: 'warn',
    };
  }

  // ============================================================
  // XATOLAR — TARMOQ
  // ============================================================
  if (/server.*javob bermadi|Render.*javob/i.test(text)) {
    const waitMatch = text.match(/(\d+)s/);
    const wait = waitMatch ? ` (${waitMatch[1]} soniyadan keyin qayta)` : '';
    return { message: `\u{1F310} Internet server hozir ishlamayapti${wait}`, level: 'warn' };
  }

  if (/timeout.*ms exceeded/i.test(text)) {
    return { message: '\u23F1\uFE0F Qurilma juda sekin javob berdi — tarmoqni tekshiring', level: 'warn' };
  }

  if (/ECONNRESET|ECONNABORTED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ENETUNREACH/i.test(text)) {
    return { message: '\u{1F310} Tarmoq uzildi — o\'zi qayta urinadi', level: 'warn' };
  }

  if (/ro.yxatga olish.*server band/i.test(text)) {
    const m = text.match(/(\d+)s dan keyin/i);
    const wait = m ? ` (${m[1]}s keyin)` : '';
    return { message: `\u{1F310} Server band${wait} — qayta uriniladi`, level: 'warn' };
  }

  // ============================================================
  // XATOLAR — RASM / YUZ
  // ============================================================
  if (/PicFeaturePoints|SubpicAnalysisModelingError/i.test(text)) {
    return {
      message: '\u{1F4F7} Rasm sifati yetarli emas — haydovchining aniq yuz rasmini yuklang',
      level: 'error',
    };
  }

  if (/rasm.*bo.sh|rasm.*kichik/i.test(text)) {
    return { message: '\u{1F4F7} Haydovchining rasmi yo\'q yoki buzilgan', level: 'error' };
  }

  if (/\u2717.*:.*message|xatosi:|yozishda xato/i.test(text)) {
    const nameMatch = text.match(/\u2717\s*(.+?):/i);
    const name = nameMatch ? nameMatch[1].trim() : 'Haydovchi';
    return { message: `\u274C "${name}" yozishda xato — keyinroq qayta urinadi`, level: 'error' };
  }

  // ============================================================
  // AUTH XATOLARI
  // ============================================================
  if (/AGENT_KEY noto.g.ri|HTTP 401|HTTP 403/i.test(text)) {
    return {
      message: '\u{1F511} Noto\'g\'ri kalit — Qurilmalar menyusida Agent kalitini yangilang',
      level: 'error',
    };
  }

  // ============================================================
  // SYNC / YANGILASH
  // ============================================================
  if (/sync|yangilash/i.test(text) && /fayl/i.test(text)) {
    return { message: '\u{1F504} Agent fayllari yangilandi — qayta ishga tushirilmoqda', level: 'info' };
  }

  // ============================================================
  // UMUMIY FALLBACK
  // ============================================================
  if (/xato|error|fail|\u2717/i.test(text)) {
    return { message: `\u274C ${text.slice(0, 120)}`, level: 'error' };
  }
  if (/ogohlantirish|warn|band|kutish/i.test(text)) {
    return { message: `\u26A0\uFE0F ${text.slice(0, 120)}`, level: 'warn' };
  }

  return { message: `\u2139\uFE0F ${text.slice(0, 120)}`, level: 'info' };
}
