const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const MAX_BYTES = 180 * 1024;
const MAX_PASSTHROUGH_BYTES = 400 * 1024;
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

function loadSharp() {
  try {
    return require("sharp");
  } catch {
    return null;
  }
}

/**
 * Read SOF0/SOF2 chroma sampling. Hikvision FDLib modeling expects 4:2:0
 * (Y 2x2, Cb/Cr 1x1). Jimp/jpeg-js encodes 4:4:4, which this device rejects
 * as PicFeaturePoints / SubpicAnalysisModelingError.
 */
function jpegSofInfo(buffer) {
  if (!isJpeg(buffer)) return null;
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
      const comps = [];
      for (let i = 0; i < nf; i++) {
        const hv = buffer[offset + 11 + i * 3];
        comps.push({ id: buffer[offset + 10 + i * 3], h: hv >> 4, v: hv & 0xf });
      }
      const y = comps.find((c) => c.id === 1) || comps[0];
      const cb = comps.find((c) => c.id === 2);
      let chroma = "unknown";
      if (y && cb && y.h === 2 && y.v === 2 && cb.h === 1 && cb.v === 1) chroma = "4:2:0";
      else if (y && cb && y.h === 1 && y.v === 1 && cb.h === 1 && cb.v === 1) chroma = "4:4:4";
      if (marker === 0xc2) chroma += " progressive";
      return {
        width: buffer.readUInt16BE(offset + 7),
        height: buffer.readUInt16BE(offset + 5),
        chroma,
      };
    }
    if (size < 2) break;
    offset += 2 + size;
  }
  return null;
}

function jpegChromaLabel(buffer) {
  return jpegSofInfo(buffer)?.chroma || (isJpeg(buffer) ? "unknown" : "not-jpeg");
}

function jpegExifOrientation(buffer) {
  if (!isJpeg(buffer)) return 1;
  let offset = 2;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) break;
    const marker = buffer[offset + 1];
    if (marker === 0xda || marker === 0xd9) break;
    const size = buffer.readUInt16BE(offset + 2);
    if (marker === 0xe1) {
      const body = buffer.subarray(offset + 4, offset + 2 + size);
      if (body.toString("ascii", 0, 4) === "Exif") {
        const tiff = body.subarray(6);
        const le = tiff.toString("ascii", 0, 2) === "II";
        const read16 = (o) => (le ? tiff.readUInt16LE(o) : tiff.readUInt16BE(o));
        const read32 = (o) => (le ? tiff.readUInt32LE(o) : tiff.readUInt32BE(o));
        const ifd = read32(4);
        const count = read16(ifd);
        for (let i = 0; i < count; i++) {
          const e = ifd + 2 + i * 12;
          if (read16(e) === 0x0112) return read16(e + 8) || 1;
        }
      }
    }
    if (size < 2) break;
    offset += 2 + size;
  }
  return 1;
}

function result(buffer, extra = {}) {
  return {
    buffer,
    width: extra.width || 0,
    height: extra.height || 0,
    chroma: extra.chroma || jpegChromaLabel(buffer),
    reencoded: Boolean(extra.reencoded),
  };
}

async function prepareWithSharp(sharp, input) {
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
    input.length <= MAX_PASSTHROUGH_BYTES &&
    jpegChromaLabel(input) === "4:2:0";

  if (alreadyGoodJpeg) {
    return result(input, {
      width: srcW,
      height: srcH,
      chroma: "4:2:0",
      reencoded: false,
    });
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
    const encoded = await resized
      .jpeg({
        quality,
        chromaSubsampling: "4:2:0",
        progressive: false,
        mozjpeg: false,
        force: true,
      })
      .toBuffer({ resolveWithObject: true });
    buffer = encoded.data;
    info = encoded.info;
    if (buffer.length <= MAX_BYTES) break;
    quality -= 10;
  }

  return result(buffer, {
    width: info.width,
    height: info.height,
    chroma: jpegChromaLabel(buffer),
    reencoded: true,
  });
}

const WINDOWS_PS = `
param($InPath, $OutPath)
Add-Type -AssemblyName System.Drawing
$bytes = [System.IO.File]::ReadAllBytes($InPath)
$ms = New-Object System.IO.MemoryStream(,$bytes)
$src = [System.Drawing.Image]::FromStream($ms)
$orient = 1
foreach ($p in $src.PropertyItems) {
  if ($p.Id -eq 0x0112 -and $p.Value.Length -ge 2) {
    $orient = [BitConverter]::ToUInt16($p.Value, 0)
  }
}
switch ($orient) {
  2 { $src.RotateFlip([System.Drawing.RotateFlipType]::RotateNoneFlipX) }
  3 { $src.RotateFlip([System.Drawing.RotateFlipType]::Rotate180FlipNone) }
  4 { $src.RotateFlip([System.Drawing.RotateFlipType]::RotateNoneFlipY) }
  5 { $src.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipX) }
  6 { $src.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipNone) }
  7 { $src.RotateFlip([System.Drawing.RotateFlipType]::Rotate270FlipX) }
  8 { $src.RotateFlip([System.Drawing.RotateFlipType]::Rotate270FlipNone) }
}
$maxW = 600; $maxH = 1200
$w = $src.Width; $h = $src.Height
if ($w -lt 1 -or $h -lt 1) { throw 'empty image' }
$scale = [Math]::Min(1.0, [Math]::Min($maxW / $w, $maxH / $h))
$nw = [Math]::Max(80, [int]($w * $scale))
$nh = [Math]::Max(80, [int]($h * $scale))
$bmp = New-Object System.Drawing.Bitmap($nw, $nh)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($src, 0, 0, $nw, $nh)
$g.Dispose(); $src.Dispose(); $ms.Dispose()
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]85)
$bmp.Save($OutPath, $codec, $ep)
$bmp.Dispose()
`;

function prepareWithWindowsGdi(input) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sp-face-"));
  const inFile = path.join(dir, "in.bin");
  const outFile = path.join(dir, "out.jpg");
  const psFile = path.join(dir, "run.ps1");
  try {
    fs.writeFileSync(inFile, input);
    fs.writeFileSync(psFile, WINDOWS_PS, "utf8");
    execFileSync(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", psFile, inFile, outFile],
      { timeout: 20000, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
    );
    const buffer = fs.readFileSync(outFile);
    if (buffer.length < 100) throw new Error("Windows JPEG bo'sh");
    const sof = jpegSofInfo(buffer);
    return result(buffer, {
      width: sof?.width,
      height: sof?.height,
      chroma: jpegChromaLabel(buffer),
      reencoded: true,
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
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

  const orientation = jpegExifOrientation(input);
  const sof = jpegSofInfo(input);
  const chroma = sof?.chroma || jpegChromaLabel(input);
  if (sof && (sof.width < 80 || sof.height < 80)) {
    throw new Error(
      `Rasm juda kichik (${sof.width}x${sof.height}). Face ID uchun kamida 80x80 kerak.`,
    );
  }
  const tooBig =
    Boolean(sof) && (sof.width > MAX_WIDTH || sof.height > MAX_HEIGHT);
  const alreadyGoodJpeg =
    isJpeg(input) &&
    orientation === 1 &&
    !tooBig &&
    input.length <= MAX_PASSTHROUGH_BYTES &&
    chroma === "4:2:0";
  if (alreadyGoodJpeg) {
    return result(input, {
      width: sof?.width,
      height: sof?.height,
      chroma: "4:2:0",
      reencoded: false,
    });
  }

  const sharp = loadSharp();
  if (sharp) {
    try {
      return await prepareWithSharp(sharp, input);
    } catch (error) {
      if (process.platform !== "win32") {
        throw new Error(
          `Rasmni Face ID formatiga o'girib bo'lmadi: ${error.message}. Boshqa aniq yuz rasmini JPEG qilib yuklang.`,
        );
      }
    }
  }

  if (process.platform === "win32") {
    try {
      return prepareWithWindowsGdi(input);
    } catch (error) {
      if (isJpeg(input) && input.length <= MAX_PASSTHROUGH_BYTES) {
        return result(input, { chroma: chroma || "original-jpeg", reencoded: false });
      }
      throw new Error(
        `Rasmni Face ID formatiga o'girib bo'lmadi: ${error.message}. Boshqa aniq yuz rasmini JPEG qilib yuklang.`,
      );
    }
  }

  if (isJpeg(input) && input.length <= MAX_PASSTHROUGH_BYTES) {
    return result(input, { chroma: chroma || "original-jpeg", reencoded: false });
  }

  throw new Error(
    "Rasmni Face ID formatiga o'girib bo'lmadi. Aniq yuz rasmini JPEG qilib yuklang.",
  );
}

module.exports = {
  prepareFaceJpeg,
  jpegChromaLabel,
  jpegSofInfo,
  isJpeg,
  MAX_BYTES,
  MAX_WIDTH,
  MAX_HEIGHT,
  MAX_PASSTHROUGH_BYTES,
};
