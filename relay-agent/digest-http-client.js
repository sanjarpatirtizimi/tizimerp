const http = require("http");
const axios = require("axios");
const { createHash, randomBytes } = require("crypto");
const { Readable } = require("stream");

/**
 * Minimal HTTP Digest Authentication client for Hikvision ISAPI devices.
 * Buffers stream/FormData bodies so a 401 digest retry can resend the same bytes.
 *
 * Face ID boxes typically serve one HTTP request at a time. A shared keep-alive
 * pool leaves a timed-out AcsEvent socket occupying the only slot, so the next
 * face upload also hangs. Each client gets its own agent and drops it on timeout.
 */
class DigestHttpClient {
  constructor(baseURL, username, password, timeoutMs = 10000) {
    this.username = username;
    this.password = password;
    this.cachedChallenge = null;
    this.nonceCount = 0;
    this.timeoutMs = timeoutMs;
    this.http = axios.create({
      baseURL,
      timeout: timeoutMs,
      httpAgent: this.createAgent(),
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      // Keep binary multipart intact, but still JSON-stringify plain objects.
      transformRequest: [
        (data, headers) => {
          if (data == null) return data;
          if (Buffer.isBuffer(data)) return data;
          if (typeof data === "string") return data;
          if (typeof ArrayBuffer !== "undefined" && data instanceof ArrayBuffer) {
            return data;
          }
          if (typeof data.pipe === "function") return data;
          if (typeof data === "object") {
            const contentType =
              headers["Content-Type"] || headers["content-type"] || "";
            if (
              typeof contentType === "string" &&
              contentType.includes("application/json")
            ) {
              return JSON.stringify(data);
            }
            // Default JSON for plain objects (UserInfo Record/Modify, etc).
            if (!contentType) {
              headers["Content-Type"] = "application/json";
            }
            return JSON.stringify(data);
          }
          return data;
        },
      ],
      validateStatus: () => true,
    });
  }

  createAgent() {
    return new http.Agent({
      keepAlive: false,
      maxSockets: 1,
      timeout: this.timeoutMs,
    });
  }

  resetTransport() {
    this.cachedChallenge = null;
    const prev = this.http.defaults.httpAgent;
    if (prev && typeof prev.destroy === "function") {
      prev.destroy();
    }
    this.http.defaults.httpAgent = this.createAgent();
  }

  get(url, extra = {}) {
    return this.execute("GET", url, {}, extra);
  }

  put(url, body, extra = {}) {
    return this.execute("PUT", url, body, extra);
  }

  post(url, body, extra = {}) {
    return this.execute("POST", url, body, extra);
  }

  delete(url, body = {}, extra = {}) {
    return this.execute("DELETE", url, body, extra);
  }

  async execute(method, url, body, extra = {}) {
    const prepared = await this.prepareBody(body);
    const config = {
      method,
      url,
      data: prepared.data,
      headers: { ...prepared.headers },
    };
    if (extra.timeout) config.timeout = extra.timeout;

    if (this.cachedChallenge) {
      config.headers = {
        ...config.headers,
        Authorization: this.buildAuthorizationHeader(
          method,
          url,
          this.cachedChallenge,
        ),
      };
    }

    try {
      let response = await this.http.request(config);

      if (response.status === 401) {
        const challenge = this.parseChallenge(response.headers["www-authenticate"]);
        if (!challenge) return response;
        this.cachedChallenge = challenge;
        // Resend the SAME buffered bytes — critical for multipart face uploads.
        config.headers = {
          ...prepared.headers,
          Authorization: this.buildAuthorizationHeader(method, url, challenge),
        };
        config.data = prepared.data;
        response = await this.http.request(config);
      }

      return response;
    } catch (error) {
      this.resetTransport();
      throw error;
    }
  }

  async prepareBody(body) {
    const headers = { ...(body.headers || {}) };
    let data = body.data;

    if (data == null) {
      return { data, headers };
    }

    // form-data instances are readable streams — buffer them for digest retries.
    if (typeof data.getBuffer === "function") {
      data = await data.getBuffer();
    } else if (typeof data.getLengthSync === "function" || this.looksLikeFormData(data)) {
      data = await this.streamToBuffer(data);
    } else if (Readable.isReadable(data) && typeof data.read === "function") {
      data = await this.streamToBuffer(data);
    }

    if (Buffer.isBuffer(data) && headers["content-type"] && !headers["Content-Length"]) {
      headers["Content-Length"] = String(data.length);
    }

    return { data, headers };
  }

  looksLikeFormData(data) {
    return Boolean(
      data &&
        typeof data.pipe === "function" &&
        typeof data.getHeaders === "function",
    );
  }

  streamToBuffer(stream) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on("end", () => resolve(Buffer.concat(chunks)));
      stream.on("error", reject);
      if (typeof stream.resume === "function") stream.resume();
    });
  }

  parseChallenge(header) {
    if (!header || !header.toLowerCase().startsWith("digest")) return null;

    const params = {};
    const regex = /(\w+)=(?:"([^"]*)"|([^,\s]+))/g;
    let match;
    while ((match = regex.exec(header)) !== null) {
      params[match[1]] = match[2] ?? match[3];
    }
    if (!params.realm || !params.nonce) return null;

    return {
      realm: params.realm,
      nonce: params.nonce,
      qop: params.qop,
      opaque: params.opaque,
    };
  }

  buildAuthorizationHeader(method, uri, challenge) {
    this.nonceCount += 1;
    const nc = this.nonceCount.toString(16).padStart(8, "0");
    const cnonce = randomBytes(8).toString("hex");

    const ha1 = this.md5(`${this.username}:${challenge.realm}:${this.password}`);
    // Digest HA2 must use the request-URI as sent (path + query).
    const ha2 = this.md5(`${method}:${uri}`);

    let response;
    if (challenge.qop) {
      response = this.md5(
        `${ha1}:${challenge.nonce}:${nc}:${cnonce}:${challenge.qop}:${ha2}`,
      );
    } else {
      response = this.md5(`${ha1}:${challenge.nonce}:${ha2}`);
    }

    const parts = [
      `username="${this.username}"`,
      `realm="${challenge.realm}"`,
      `nonce="${challenge.nonce}"`,
      `uri="${uri}"`,
      `response="${response}"`,
    ];
    if (challenge.qop) {
      parts.push(`qop=${challenge.qop}`, `nc=${nc}`, `cnonce="${cnonce}"`);
    }
    if (challenge.opaque) {
      parts.push(`opaque="${challenge.opaque}"`);
    }

    return `Digest ${parts.join(", ")}`;
  }

  md5(value) {
    return createHash("md5").update(value).digest("hex");
  }
}

module.exports = { DigestHttpClient };
