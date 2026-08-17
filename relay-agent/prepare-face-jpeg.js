const sharp = require("sharp");

const MAX_BYTES = 180 * 1024;
const MAX_WIDTH = 600;
const MAX_HEIGHT = 1200;

function isJpeg(buffer) {
  return (
    Buffer.isBuffer(buffer) &&
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  );
}

/**
 * Read SOF0/SOF2 chroma sampling. Hikvision FDLib modeling expects 4:2:0
 * (Y 2x2, Cb/Cr 1x1). Jimp/jpeg-js encodes 4:4:4, which this device rejects
 * as PicFeaturePoints / SubpicAnalysisModelingError.
 */
function jpegChromaLabel(buffer) {
  if (!isJpeg(buffer)) return "not-jpeg";
  let offset = 2;
  while (offset + 10 <= buffer.length) {
    if (buffer[offset] !== 0xff) break;
    const marker = buffer[offset + 1];
    if (marker === 0xda || marker === 0xd9) break;
    if (marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const size = buffer.readUInt16BE(offset + 2);
    if (marker === 0xc0 || marker === 0xc2) {
      const nf = buffer[offset + 9];
      if (nf < 1 || offset + 10 + nf * 3 > buffer.length) {
        return marker === 0xc2 ? "progressive" : "baseline";
      }
      const comps = [];
      for (let i = 0; i < nf; i++) {
        const hv = buffer[offset + 11 + i * 3];
        comps.push({ id: buffer[offset + 10 + i * 3], h: hv >> 4, v: hv & 0xf });
      }
      const y = comps.find((c) => c.id === 1) || comps[0];
      const cb = comps.find((c) => c.id === 2);
      const progressive = marker === 0xc2 ? " progressive" : "";
      if (y && cb && y.h === 2 && y.v === 2 && cb.h === 1 && cb.v === 1) {
        return `4:2:0${progressive}`;
      }
      if (y && cb && y.h === 1 && y.v === 1 && cb.h === 1 && cb.v === 1) {
        return `4:4:4${progressive}`;
      }
      return `h${y.h}v${y.v}${progressive}`;
    }
    if (size < 2) break;
    offset += 2 + size;
  }
  return "unknown";
}

/**
 * Normalize a driver photo into a baseline 4:2:0 JPEG that MinMoe / ISAPI
 * FaceDataRecord will actually model. Never use Jimp/jpeg-js for the encode
 * step — that library writes 4:4:4 and the terminal returns PicFeaturePoints.
 */
async function prepareFaceJpeg(input) {
  if (!Buffer.isBuffer(input) || input.length < 100) {
    throw new Error("Rasm fayli bo'sh yoki juda kichik");
  }

  try {
    const meta = await sharp(input, { failOn: "none" }).metadata();
    const orientation = meta.orientation || 1;
    const swapped = orientation >= 5;
    const srcW = (swapped ? meta.height : meta.width) || 0;
    const srcH = (swapped ? meta.width : meta.height) || 0;
    if (srcW < 80 || srcH < 80) {
      throw new Error(
        `Rasm juda kichik (${srcW}x${srcH}). Face ID uchun kamida 80x80 kerak.`,
      );
    }

    const fitInside = srcW > MAX_WIDTH || srcH > MAX_HEIGHT;
    const alreadyGoodJpeg =
      isJpeg(input) &&
      orientation === 1 &&
      !fitInside &&
      input.length <= MAX_BYTES &&
      jpegChromaLabel(input) === "4:2:0";

    if (alreadyGoodJpeg) {
      return {
        buffer: input,
        width: srcW,
        height: srcH,
        chroma: "4:2:0",
        reencoded: false,
      };
    }

    let quality = 90;
    let buffer;
    let info;
    while (quality >= 55) {
      const pipeline = sharp(input, { failOn: "none" }).rotate();
      const resized = fitInside
        ? pipeline.resize({
            width: MAX_WIDTH,
            height: MAX_HEIGHT,
            fit: "inside",
            withoutEnlargement: true,
          })
        : pipeline;
      const result = await resized
        .jpeg({
          quality,
          chromaSubsampling: "4:2:0",
          progressive: false,
          mozjpeg: false, // mozjpeg writes progressive JPEGs; FDLib wants baseline
          force: true,
        })
        .toBuffer({ resolveWithObject: true });
      buffer = result.data;
      info = result.info;
      if (buffer.length <= MAX_BYTES) break;
      quality -= 10;
    }

    return {
      buffer,
      width: info.width,
      height: info.height,
      chroma: jpegChromaLabel(buffer),
      reencoded: true,
    };
  } catch (error) {
    throw new Error(
      `Rasmni Face ID formatiga o'girib bo'lmadi: ${error.message}. Boshqa aniq yuz rasmini JPEG qilib yuklang.`,
    );
  }
}

module.exports = {
  prepareFaceJpeg,
  jpegChromaLabel,
  isJpeg,
  MAX_BYTES,
  MAX_WIDTH,
  MAX_HEIGHT,
};
