import { Injectable } from '@nestjs/common';
import * as https from 'https';
import type { IncomingHttpHeaders } from 'http';

type SignupPayload = {
  username: string;
  email?: string;
  password: string;
  firstName?: string;
  lastName?: string;
  age?: number | string;
};

type KeycloakConfig = {
  url: string;
  realm: string;
  clientId: string;
  clientSecret?: string;
  adminUsername?: string;
  adminPassword?: string;
};

@Injectable()
export class KeycloakAdminService {
  private config?: KeycloakConfig;
  private tokenUrl?: URL;

  private loadConfig() {
    if (this.config && this.tokenUrl) {
      return;
    }

    const url = process.env.KEYCLOAK_URL;
    const realm = process.env.KEYCLOAK_REALM || 'myapp';
    const clientId = process.env.KEYCLOAK_ADMIN_CLIENT_ID;
    const clientSecret = process.env.KEYCLOAK_ADMIN_CLIENT_SECRET;
    const adminUsername = process.env.KEYCLOAK_ADMIN_USERNAME;
    const adminPassword = process.env.KEYCLOAK_ADMIN_PASSWORD;

    const hasClientCredentials = Boolean(
      clientId && clientSecret && clientSecret !== 'CHANGE_ME',
    );
    const hasAdminPasswordGrant = Boolean(clientId && adminUsername && adminPassword);

    if (!url || !realm || !clientId || (!hasClientCredentials && !hasAdminPasswordGrant)) {
      throw new Error(
        'Keycloak admin client is not configured. Set a valid KEYCLOAK_ADMIN_CLIENT_SECRET or provide KEYCLOAK_ADMIN_USERNAME and KEYCLOAK_ADMIN_PASSWORD.',
      );
    }

    this.config = { url, realm, clientId, clientSecret, adminUsername, adminPassword };
    this.tokenUrl = new URL(`${url}/realms/${realm}/protocol/openid-connect/token`);
  }

  async createUser(payload: SignupPayload) {
    this.loadConfig();
    const token = await this.fetchAdminToken();
    const { url, realm } = this.config!;
    const endpoint = new URL(`${url}/admin/realms/${realm}/users`);

    const body = JSON.stringify({
      username: payload.username,
      email: payload.email || undefined,
      firstName: payload.firstName || undefined,
      lastName: payload.lastName || undefined,
      enabled: true,
      emailVerified: Boolean(payload.email),
      attributes: payload.age ? { age: [String(payload.age)] } : undefined,
      credentials: [
        {
          type: 'password',
          value: payload.password,
          temporary: false,
        },
      ],
    });

    const result = await this.request('POST', endpoint, {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }, body);

    if (result.status < 200 || result.status >= 300) {
      const detail = result.body || 'Failed to create user';
      const error = new Error(detail);
      (error as any).status = result.status;
      throw error;
    }
  }

  async findUserByUsername(username: string) {
    this.loadConfig();
    const token = await this.fetchAdminToken();
    const { url, realm } = this.config!;
    const endpoint = new URL(`${url}/admin/realms/${realm}/users`);
    endpoint.searchParams.set('username', username);
    endpoint.searchParams.set('exact', 'true');

    const result = await this.request('GET', endpoint, {
      Authorization: `Bearer ${token}`,
    });

    if (result.status < 200 || result.status >= 300) {
      const detail = result.body || 'Failed to load user';
      const error = new Error(detail);
      (error as any).status = result.status;
      throw error;
    }

    const users = JSON.parse(result.body || '[]');
    if (!Array.isArray(users) || users.length === 0) {
      return null;
    }
    return users[0];
  }

  async searchUsers(search: string) {
    this.loadConfig();
    const token = await this.fetchAdminToken();
    const { url, realm } = this.config!;
    const endpoint = new URL(`${url}/admin/realms/${realm}/users`);
    endpoint.searchParams.set('search', search);

    const result = await this.request('GET', endpoint, {
      Authorization: `Bearer ${token}`,
    });

    if (result.status < 200 || result.status >= 300) {
      const detail = result.body || 'Failed to search users';
      const error = new Error(detail);
      (error as any).status = result.status;
      throw error;
    }

    const users = JSON.parse(result.body || '[]');
    if (!Array.isArray(users)) {
      return [];
    }

    return users.map((user) => ({
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    }));
  }

  async deleteUserByUsername(username: string) {
    this.loadConfig();
    const user = await this.findUserByUsername(username);
    if (!user?.id) {
      return false;
    }
    const token = await this.fetchAdminToken();
    const { url, realm } = this.config!;
    const endpoint = new URL(`${url}/admin/realms/${realm}/users/${user.id}`);

    const result = await this.request('DELETE', endpoint, {
      Authorization: `Bearer ${token}`,
    });

    if (result.status === 200 || result.status === 204) {
      return true;
    }

    const detail = result.body || 'Failed to delete user';
    const error = new Error(detail);
    (error as any).status = result.status;
    throw error;
  }

  async setUserEnabled(username: string, enabled: boolean) {
    this.loadConfig();
    const user = await this.findUserByUsername(username);
    if (!user?.id) {
      return false;
    }

    const token = await this.fetchAdminToken();
    const { url, realm } = this.config!;
    const endpoint = new URL(`${url}/admin/realms/${realm}/users/${user.id}`);

    const existing = await this.fetchUserById(user.id, token);
    const body = JSON.stringify({ ...existing, enabled });

    const result = await this.request(
      'PUT',
      endpoint,
      {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body,
    );

    if (result.status === 200 || result.status === 204) {
      return true;
    }

    const detail = result.body || 'Failed to update user';
    const error = new Error(detail);
    (error as any).status = result.status;
    throw error;
  }

  private async fetchAdminToken() {
    const { clientId, clientSecret, adminUsername, adminPassword } = this.config!;

    if (clientSecret && clientSecret !== 'CHANGE_ME') {
      const result = await this.request(
        'POST',
        this.tokenUrl!,
        { 'Content-Type': 'application/x-www-form-urlencoded' },
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
        }).toString(),
      );

      if (result.status >= 200 && result.status < 300) {
        return this.parseAccessToken(result.body);
      }

      if (!adminUsername || !adminPassword) {
        throw new Error(
          `Keycloak token request failed (${result.status}). Check KEYCLOAK_ADMIN_CLIENT_SECRET and ensure client "${clientId}" is confidential with service accounts enabled.`,
        );
      }
    }

    if (!adminUsername || !adminPassword) {
      throw new Error('Keycloak admin password grant is not configured');
    }

    const fallbackResult = await this.request(
      'POST',
      this.tokenUrl!,
      { 'Content-Type': 'application/x-www-form-urlencoded' },
      new URLSearchParams({
        grant_type: 'password',
        client_id: clientId,
        username: adminUsername,
        password: adminPassword,
      }).toString(),
    );

    if (fallbackResult.status < 200 || fallbackResult.status >= 300) {
      throw new Error(
        `Keycloak token request failed (${fallbackResult.status}). Check admin client credentials and fallback admin username/password.`,
      );
    }

    return this.parseAccessToken(fallbackResult.body);
  }

  private parseAccessToken(body: string) {
    const data = JSON.parse(body || '{}');
    if (!data.access_token) {
      throw new Error('Keycloak token response missing access_token');
    }

    return data.access_token as string;
  }

  private async fetchUserById(userId: string, token: string) {
    const { url, realm } = this.config!;
    const endpoint = new URL(`${url}/admin/realms/${realm}/users/${userId}`);
    const result = await this.request('GET', endpoint, {
      Authorization: `Bearer ${token}`,
    });

    if (result.status < 200 || result.status >= 300) {
      const detail = result.body || 'Failed to load user';
      const error = new Error(detail);
      (error as any).status = result.status;
      throw error;
    }

    return JSON.parse(result.body || '{}');
  }

  private request(
    method: string,
    url: URL,
    headers: Record<string, string>,
    body?: string,
  ) {
    return new Promise<{ status: number; body: string; headers: IncomingHttpHeaders }>(
      (resolve, reject) => {
        const req = https.request(
          url,
          { method, headers },
          (res) => {
            const chunks: Buffer[] = [];
            res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
            res.on('end', () => {
              resolve({
                status: res.statusCode || 0,
                body: Buffer.concat(chunks).toString('utf8'),
                headers: res.headers,
              });
            });
          },
        );

        req.on('error', reject);
        if (body) {
          req.write(body);
        }
        req.end();
      },
    );
  }
}
