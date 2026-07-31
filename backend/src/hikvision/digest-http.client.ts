import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { createHash, randomBytes } from 'crypto';

interface DigestChallenge {
  realm: string;
  nonce: string;
  qop?: string;
  opaque?: string;
  algorithm?: string;
}

export interface RequestBody {
  data?: unknown;
  headers?: Record<string, string>;
}

/**
 * Minimal HTTP Digest Authentication client for Hikvision ISAPI devices.
 *
 * Hikvision cameras/terminals require RFC 2617 Digest Auth on every ISAPI
 * call. This client:
 *  1. Sends the request unauthenticated.
 *  2. On a 401 with a `WWW-Authenticate: Digest ...` challenge, computes the
 *     response hash and retries once with the `Authorization` header set.
 *  3. Caches the challenge + nonce-count per instance so subsequent calls to
 *     the same device skip step 1/2 (until the device rejects a stale nonce,
 *     at which point it re-negotiates automatically).
 */
export class DigestHttpClient {
  private readonly http: AxiosInstance;
  private cachedChallenge: DigestChallenge | null = null;
  private nonceCount = 0;

  constructor(
    baseURL: string,
    private readonly username: string,
    private readonly password: string,
    timeoutMs = 10000,
  ) {
    this.http = axios.create({
      baseURL,
      timeout: timeoutMs,
      validateStatus: () => true, // we handle 401 ourselves
    });
  }

  async get<T = unknown>(url: string): Promise<AxiosResponse<T>> {
    return this.execute<T>('GET', url, {});
  }

  async put<T = unknown>(
    url: string,
    body: RequestBody,
  ): Promise<AxiosResponse<T>> {
    return this.execute<T>('PUT', url, body);
  }

  async post<T = unknown>(
    url: string,
    body: RequestBody,
  ): Promise<AxiosResponse<T>> {
    return this.execute<T>('POST', url, body);
  }

  async delete<T = unknown>(url: string): Promise<AxiosResponse<T>> {
    return this.execute<T>('DELETE', url, {});
  }

  private async execute<T>(
    method: string,
    url: string,
    body: RequestBody,
  ): Promise<AxiosResponse<T>> {
    const config: AxiosRequestConfig = {
      method,
      url,
      data: body.data,
      headers: { ...body.headers },
    };

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

    let response = await this.http.request<T>(config);

    if (response.status === 401) {
      const challenge = this.parseChallenge(
        response.headers['www-authenticate'] as string | undefined,
      );
      if (!challenge) {
        return response; // not digest auth, nothing more we can do
      }
      this.cachedChallenge = challenge;
      config.headers = {
        ...body.headers,
        Authorization: this.buildAuthorizationHeader(method, url, challenge),
      };
      response = await this.http.request<T>(config);
    }

    return response;
  }

  private parseChallenge(header?: string): DigestChallenge | null {
    if (!header || !header.toLowerCase().startsWith('digest')) return null;

    const params: Record<string, string> = {};
    const regex = /(\w+)=(?:"([^"]*)"|([^,\s]+))/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(header)) !== null) {
      params[match[1]] = match[2] ?? match[3];
    }

    if (!params.realm || !params.nonce) return null;

    return {
      realm: params.realm,
      nonce: params.nonce,
      qop: params.qop,
      opaque: params.opaque,
      algorithm: params.algorithm,
    };
  }

  private buildAuthorizationHeader(
    method: string,
    uri: string,
    challenge: DigestChallenge,
  ): string {
    this.nonceCount += 1;
    const nc = this.nonceCount.toString(16).padStart(8, '0');
    const cnonce = randomBytes(8).toString('hex');

    const ha1 = this.md5(
      `${this.username}:${challenge.realm}:${this.password}`,
    );
    const ha2 = this.md5(`${method}:${uri}`);

    let response: string;
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

    return `Digest ${parts.join(', ')}`;
  }

  private md5(value: string): string {
    return createHash('md5').update(value).digest('hex');
  }
}
