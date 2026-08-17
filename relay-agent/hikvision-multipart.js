/**
 * Hikvision is picky about multipart layout. Build the exact byte layout
 * documented for FaceDataRecord / FDSetUp (FaceImage, not img).
 *
 * Each part includes Content-Length so the terminal does not swallow the
 * trailing boundary into the JPEG (that also surfaces as PicFeaturePoints).
 */
function buildHikvisionFaceMultipart(employeeNo, photoBuffer) {
  const meta = JSON.stringify({
    faceLibType: "blackFD",
    FDID: "1",
    FPID: String(employeeNo),
  });
  const metaBytes = Buffer.from(meta, "utf8");
  const boundary = `----hik${Date.now().toString(16)}`;
  const CRLF = "\r\n";
  const head =
    `--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="FaceDataRecord"${CRLF}` +
    `Content-Type: application/json${CRLF}` +
    `Content-Length: ${metaBytes.length}${CRLF}` +
    `${CRLF}`;
  const mid =
    `${CRLF}--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="FaceImage"; filename="face.jpg"${CRLF}` +
    `Content-Type: image/jpeg${CRLF}` +
    `Content-Length: ${photoBuffer.length}${CRLF}` +
    `${CRLF}`;
  const tail = `${CRLF}--${boundary}--${CRLF}`;
  const data = Buffer.concat([
    Buffer.from(head, "utf8"),
    metaBytes,
    Buffer.from(mid, "utf8"),
    photoBuffer,
    Buffer.from(tail, "utf8"),
  ]);

  return {
    data,
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "Content-Length": String(data.length),
    },
  };
}

module.exports = { buildHikvisionFaceMultipart };
