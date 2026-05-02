import { KeycloakAdminService } from '../auth/keycloak-admin.service';

describe('KeycloakAdminService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('throws when admin config is missing', async () => {
    delete process.env.KEYCLOAK_URL;
    delete process.env.KEYCLOAK_ADMIN_CLIENT_ID;
    delete process.env.KEYCLOAK_ADMIN_CLIENT_SECRET;
    delete process.env.KEYCLOAK_ADMIN_USERNAME;
    delete process.env.KEYCLOAK_ADMIN_PASSWORD;
    const service = new KeycloakAdminService();

    await expect(
      service.createUser({ username: 'mila', password: 'pass', email: 'm@example.com' }),
    ).rejects.toThrow('Keycloak admin client is not configured');
  });

  it('creates users with admin token', async () => {
    process.env.KEYCLOAK_URL = 'https://keycloak.local';
    process.env.KEYCLOAK_ADMIN_CLIENT_ID = 'admin';
    process.env.KEYCLOAK_ADMIN_CLIENT_SECRET = 'secret';
    const service = new KeycloakAdminService();
    jest
      .spyOn(service as any, 'request')
      .mockResolvedValueOnce({ status: 200, body: '{"access_token":"token"}', headers: {} })
      .mockResolvedValueOnce({ status: 201, body: '', headers: {} });

    await expect(
      service.createUser({ username: 'mila', password: 'pass', email: 'm@example.com' }),
    ).resolves.toBeUndefined();
  });

  it('finds users by username', async () => {
    process.env.KEYCLOAK_URL = 'https://keycloak.local';
    process.env.KEYCLOAK_ADMIN_CLIENT_ID = 'admin';
    process.env.KEYCLOAK_ADMIN_CLIENT_SECRET = 'secret';
    const service = new KeycloakAdminService();
    jest
      .spyOn(service as any, 'request')
      .mockResolvedValueOnce({ status: 200, body: '{"access_token":"token"}', headers: {} })
      .mockResolvedValueOnce({
        status: 200,
        body: '[{"id":"1","username":"mila"}]',
        headers: {},
      });

    await expect(service.findUserByUsername('mila')).resolves.toEqual({
      id: '1',
      username: 'mila',
    });
  });

  it('returns null for missing users', async () => {
    process.env.KEYCLOAK_URL = 'https://keycloak.local';
    process.env.KEYCLOAK_ADMIN_CLIENT_ID = 'admin';
    process.env.KEYCLOAK_ADMIN_CLIENT_SECRET = 'secret';
    const service = new KeycloakAdminService();
    jest
      .spyOn(service as any, 'request')
      .mockResolvedValueOnce({ status: 200, body: '{"access_token":"token"}', headers: {} })
      .mockResolvedValueOnce({ status: 200, body: '[]', headers: {} });

    await expect(service.findUserByUsername('missing')).resolves.toBeNull();
  });

  it('searches users and maps fields', async () => {
    process.env.KEYCLOAK_URL = 'https://keycloak.local';
    process.env.KEYCLOAK_ADMIN_CLIENT_ID = 'admin';
    process.env.KEYCLOAK_ADMIN_CLIENT_SECRET = 'secret';
    const service = new KeycloakAdminService();
    jest
      .spyOn(service as any, 'request')
      .mockResolvedValueOnce({ status: 200, body: '{"access_token":"token"}', headers: {} })
      .mockResolvedValueOnce({
        status: 200,
        body: '[{"id":"1","username":"mila","firstName":"M","lastName":"L"}]',
        headers: {},
      });

    await expect(service.searchUsers('mi')).resolves.toEqual([
      { id: '1', username: 'mila', firstName: 'M', lastName: 'L', email: undefined },
    ]);
  });

  it('rejects token responses without access_token', async () => {
    process.env.KEYCLOAK_URL = 'https://keycloak.local';
    process.env.KEYCLOAK_ADMIN_CLIENT_ID = 'admin';
    process.env.KEYCLOAK_ADMIN_CLIENT_SECRET = 'secret';
    const service = new KeycloakAdminService();
    (service as any).loadConfig();
    jest
      .spyOn(service as any, 'request')
      .mockResolvedValueOnce({ status: 200, body: '{}', headers: {} });

    await expect((service as any).fetchAdminToken()).rejects.toThrow(
      'Keycloak token response missing access_token',
    );
  });

  it('falls back to password grant when client credentials fail', async () => {
    process.env.KEYCLOAK_URL = 'https://keycloak.local';
    process.env.KEYCLOAK_ADMIN_CLIENT_ID = 'admin-cli';
    process.env.KEYCLOAK_ADMIN_CLIENT_SECRET = 'wrong-secret';
    process.env.KEYCLOAK_ADMIN_USERNAME = 'kc-admin';
    process.env.KEYCLOAK_ADMIN_PASSWORD = 'kc-pass';
    const service = new KeycloakAdminService();
    (service as any).loadConfig();
    jest
      .spyOn(service as any, 'request')
      .mockResolvedValueOnce({ status: 401, body: '{"error":"unauthorized_client"}', headers: {} })
      .mockResolvedValueOnce({ status: 200, body: '{"access_token":"fallback-token"}', headers: {} });

    await expect((service as any).fetchAdminToken()).resolves.toBe('fallback-token');
  });

  it('rejects placeholder secrets without fallback credentials', async () => {
    process.env.KEYCLOAK_URL = 'https://keycloak.local';
    process.env.KEYCLOAK_ADMIN_CLIENT_ID = 'socialbook-admin';
    process.env.KEYCLOAK_ADMIN_CLIENT_SECRET = 'CHANGE_ME';
    delete process.env.KEYCLOAK_ADMIN_USERNAME;
    delete process.env.KEYCLOAK_ADMIN_PASSWORD;
    const service = new KeycloakAdminService();

    await expect(
      service.createUser({ username: 'mila', password: 'pass', email: 'm@example.com' }),
    ).rejects.toThrow(
      'Keycloak admin client is not configured. Set a valid KEYCLOAK_ADMIN_CLIENT_SECRET or provide KEYCLOAK_ADMIN_USERNAME and KEYCLOAK_ADMIN_PASSWORD.',
    );
  });
});
