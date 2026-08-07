const axios = require("axios");
const { createHash, randomBytes } = require("crypto");

/**
 * Minimal HTTP Digest Authentication client for Hikvision ISAPI devices.
 * Plain-JS port of the backend's `DigestHttpClient` (same protocol logic),
 * kept dependency-free from the NestJS app so this agent can run standalone
 * anywhere Node.js runs (Windows tablet, mini PC, Raspberry Pi, etc).
 */
class DigestHttpClient {
  constructor(baseURL, username, password, timeoutMs = 10000) {
    this.username = username;
    this.password = password;
    this.cachedChallenge = null;
    this.nonceCount = 0;
    this.http = axios.create({
      baseURL,
      timeout: timeoutMs,
      validateStatus: () => true,
    });
  }

  get(url) {
    return this.execute("GET", url, {});
  }

  put(url, body) {
    return this.execute("PUT", url, body);
  }

  post(url, body) {
    return this.execute("POST", url, body);
  }

  async execute(method, url, body) {
    const config = {
      method,
      url,
      data: body.data,
      headers: { ...body.headers },
    };

    if (this.cachedChallenge) {
      config.headers = {
        ...config.headers,
        Authorization: this.buildAuthorizationHeader(method, url, this.cachedChallenge),
      };
    }

    let response = await this.http.request(config);

    if (response.status === 401) {
      const challenge = this.parseChallenge(response.headers["www-authenticate"]);
      if (!challenge) return response;
      this.cachedChallenge = challenge;
      config.headers = {
        ...body.headers,
        Authorization: this.buildAuthorizationHeader(method, url, challenge),
      };
      response = await this.http.request(config);
    }

    return response;
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
    const ha2 = this.md5(`${method}:${uri}`);

    let response;
    if (challenge.qop) {
      response = this.md5(`${ha1}:${challenge.nonce}:${nc}:${cnonce}:${challenge.qop}:${ha2}`);
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
