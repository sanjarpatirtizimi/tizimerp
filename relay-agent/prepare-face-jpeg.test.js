const { test } = require("node:test");
const assert = require("node:assert/strict");
const sharp = require("sharp");
const {
  prepareFaceJpeg,
  jpegChromaLabel,
  isJpeg,
  MAX_BYTES,
  MAX_WIDTH,
  MAX_HEIGHT,
} = require("./prepare-face-jpeg");

function withOrientation(jpeg, orientation) {
  const tiff = Buffer.alloc(26);
  tiff.write("II*\0", 0);
  tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(1, 8);
  tiff.writeUInt16LE(0x0112, 10);
  tiff.writeUInt16LE(3, 12);
  tiff.writeUInt32LE(1, 14);
  tiff.writeUInt32LE(orientation, 18);
  tiff.writeUInt32LE(0, 22);
  const payload = Buffer.concat([Buffer.from("Exif\0\0"), tiff]);
  const app1 = Buffer.alloc(4 + payload.length);
  app1[0] = 0xff;
  app1[1] = 0xe1;
  app1.writeUInt16BE(payload.length + 2, 2);
  payload.copy(app1, 4);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app1, jpeg.subarray(2)]);
}

async function makePhoto({ width, height, quality = 90 }) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 190, g: 140, b: 110 },
    },
  })
    .jpeg({
      quality,
      chromaSubsampling: "4:2:0",
      progressive: false,
    })
    .toBuffer();
}

test("jpegChromaLabel detects 4:4:4 (the old Jimp bug)", async () => {
  const jpeg = await sharp({
    create: {
      width: 120,
      height: 160,
      channels: 3,
      background: { r: 10, g: 20, b: 30 },
    },
  })
    .jpeg({
      quality: 80,
      chromaSubsampling: "4:4:4",
      progressive: false,
    })
    .toBuffer();
  assert.equal(jpegChromaLabel(jpeg), "4:4:4");
  const out = await prepareFaceJpeg(jpeg);
  assert.equal(out.chroma, "4:2:0");
  assert.equal(out.reencoded, true);
});

test("prepareFaceJpeg keeps a small upright 4:2:0 JPEG", async () => {
  const jpeg = await makePhoto({ width: 240, height: 320 });
  const out = await prepareFaceJpeg(jpeg);
  assert.equal(out.reencoded, false);
  assert.equal(out.chroma, "4:2:0");
  assert.equal(out.width, 240);
  assert.equal(out.height, 320);
  assert.equal(out.buffer, jpeg);
});

test("prepareFaceJpeg bakes EXIF orientation 6 into pixels", async () => {
  const landscape = await makePhoto({ width: 400, height: 200 });
  const oriented = withOrientation(landscape, 6);
  const out = await prepareFaceJpeg(oriented);
  assert.equal(out.reencoded, true);
  assert.ok(out.height > out.width, `expected portrait, got ${out.width}x${out.height}`);
  assert.equal(out.chroma, "4:2:0");
  assert.equal(jpegChromaLabel(out.buffer), "4:2:0");
});

test("prepareFaceJpeg downscales huge photos into Hikvision limits", async () => {
  const jpeg = await makePhoto({ width: 2400, height: 3200, quality: 95 });
  const out = await prepareFaceJpeg(jpeg);
  assert.equal(out.reencoded, true);
  assert.ok(out.width <= MAX_WIDTH, out.width);
  assert.ok(out.height <= MAX_HEIGHT, out.height);
  assert.ok(out.buffer.length <= MAX_BYTES, out.buffer.length);
  assert.equal(out.chroma, "4:2:0");
  assert.equal(out.buffer[0], 0xff);
  assert.equal(out.buffer[1], 0xd8);
});

test("prepareFaceJpeg converts PNG to 4:2:0 JPEG", async () => {
  const png = await sharp({
    create: {
      width: 300,
      height: 400,
      channels: 4,
      background: { r: 20, g: 80, b: 160, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
  const out = await prepareFaceJpeg(png);
  assert.equal(out.reencoded, true);
  assert.equal(isJpeg(out.buffer), true);
  assert.equal(out.chroma, "4:2:0");
});

test("prepareFaceJpeg rejects tiny images", async () => {
  const jpeg = await makePhoto({ width: 40, height: 40 });
  await assert.rejects(() => prepareFaceJpeg(jpeg), /kichik/);
});
