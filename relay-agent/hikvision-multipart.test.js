const { test } = require("node:test");
const assert = require("node:assert/strict");
const { buildHikvisionFaceMultipart } = require("./hikvision-multipart");

test("multipart includes per-part Content-Length and JPEG bytes intact", () => {
  const jpeg = Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    Buffer.alloc(32, 7),
    Buffer.from([0xff, 0xd9]),
  ]);
  const payload = buildHikvisionFaceMultipart("cmtxestpersonid000000001", jpeg);
  const text = payload.data.toString("latin1");

  assert.match(payload.headers["Content-Type"], /multipart\/form-data; boundary=----hik/);
  assert.equal(payload.headers["Content-Length"], String(payload.data.length));
  assert.match(text, /name="FaceDataRecord"/);
  assert.match(text, /name="FaceImage"; filename="face.jpg"/);
  assert.match(text, /Content-Length: 38/);
  assert.ok(payload.data.includes(jpeg), "raw JPEG must be copied unchanged");
  assert.match(text, /"FPID":"cmtxestpersonid000000001"/);
  assert.match(text, /"FDID":"1"/);
});
