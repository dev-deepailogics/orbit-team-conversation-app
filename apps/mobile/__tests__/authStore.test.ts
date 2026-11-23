import type { AxiosAdapter } from 'axios';

const keychain: { password: string | null } = { password: null };
jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: { AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'x' },
  setGenericPassword: jest.fn(async (_u: string, p: string) => {
    keychain.password = p;
    return true;
  }),
  getGenericPassword: jest.fn(async () => (keychain.password ? { username: 'orbit', password: keychain.password } : false)),
  resetGenericPassword: jest.fn(async () => {
    keychain.password = null;
    return true;
  }),
}));

import { api } from '../src/lib/api';
import { useAuthStore } from '../src/features/auth/store';

const user = { id: 'u1', username: 'alex' };

// Fake server: responds to /api/auth/me with the given status, or a network error when status is 0.
function serverReturns(status: number) {
  const adapter: AxiosAdapter = async (config) => {
    if (status === 0) {
      throw Object.assign(new Error('Network Error'), { isAxiosError: true, config, toJSON: () => ({}) });
    }
    const response = { data: status === 200 ? user : { error: 'nope' }, status, statusText: '', headers: {}, config };
    if (status >= 400) {
      throw Object.assign(new Error('fail'), { isAxiosError: true, config, response, toJSON: () => ({}) });
    }
    return response;
  };
  api.defaults.adapter = adapter;
}

beforeEach(() => {
  keychain.password = null;
  useAuthStore.setState({ user: null, token: null, isLoading: true, bootError: null });
});

test('no saved token -> signed out', async () => {
  await useAuthStore.getState().fetchMe();
  expect(useAuthStore.getState()).toMatchObject({ user: null, isLoading: false, bootError: null });
});

test('keychain unavailable -> signed out, not stuck loading', async () => {
  const Keychain = require('react-native-keychain');
  Keychain.getGenericPassword.mockRejectedValueOnce(new Error('native module missing'));
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  await useAuthStore.getState().fetchMe();
  expect(useAuthStore.getState()).toMatchObject({ user: null, isLoading: false });
});

test('valid saved token -> restores user', async () => {
  keychain.password = 'tok';
  serverReturns(200);
  await useAuthStore.getState().fetchMe();
  expect(useAuthStore.getState()).toMatchObject({ user, token: 'tok', isLoading: false });
});

test('rejected token (401) -> wipes it', async () => {
  keychain.password = 'tok';
  serverReturns(401);
  await useAuthStore.getState().fetchMe();
  expect(useAuthStore.getState()).toMatchObject({ user: null, token: null, bootError: null });
  expect(keychain.password).toBeNull();
});

test('offline -> keeps token and shows retry', async () => {
  keychain.password = 'tok';
  serverReturns(0);
  await useAuthStore.getState().fetchMe();
  expect(useAuthStore.getState().bootError).toBeTruthy();
  expect(keychain.password).toBe('tok');
});

test('login stores token in keychain; logout clears it', async () => {
  await useAuthStore.getState().setAuth(user as never, 'new');
  expect(keychain.password).toBe('new');
  await useAuthStore.getState().logout();
  expect(keychain.password).toBeNull();
  expect(useAuthStore.getState().user).toBeNull();
});

describe('refresh tokens', () => {
  const axios = require('axios');
  const saved = (access: string, refresh: string) => JSON.stringify({ a: access, r: refresh });

  // /api/auth/me answers 401 for the stale token and 200 for the refreshed one.
  function serverWithExpiry() {
    api.defaults.adapter = (async (config) => {
      const ok = config.headers.Authorization === 'Bearer fresh';
      const response = { data: ok ? user : { error: 'expired' }, status: ok ? 200 : 401, statusText: '', headers: {}, config };
      if (!ok) throw Object.assign(new Error('fail'), { isAxiosError: true, config, response, toJSON: () => ({}) });
      return response;
    }) as AxiosAdapter;
  }

  afterEach(() => jest.restoreAllMocks());

  test('expired access token -> refreshes, retries, stores the rotated pair', async () => {
    keychain.password = saved('stale', 'r1');
    serverWithExpiry();
    const post = jest
      .spyOn(axios, 'post')
      .mockResolvedValue({ data: { accessToken: 'fresh', refreshToken: 'r2' } });

    await useAuthStore.getState().fetchMe();

    expect(post).toHaveBeenCalledWith(expect.stringContaining('/api/auth/refresh'), { refreshToken: 'r1' }, expect.anything());
    expect(useAuthStore.getState()).toMatchObject({ user, token: 'fresh', isLoading: false });
    expect(JSON.parse(keychain.password!)).toEqual({ a: 'fresh', r: 'r2' });
  });

  test('refresh token rejected -> signs out', async () => {
    keychain.password = saved('stale', 'r1');
    serverWithExpiry();
    jest.spyOn(axios, 'post').mockImplementation((async (url: string) => {
      if (String(url).includes('/refresh')) {
        throw Object.assign(new Error('fail'), { isAxiosError: true, response: { status: 401, data: {} } });
      }
      return { data: {} };
    }) as never);

    await useAuthStore.getState().fetchMe();

    expect(useAuthStore.getState()).toMatchObject({ user: null, token: null });
    expect(keychain.password).toBeNull();
  });

  test('offline during refresh -> keeps the session', async () => {
    keychain.password = saved('stale', 'r1');
    serverWithExpiry();
    jest.spyOn(axios, 'post').mockRejectedValue(Object.assign(new Error('Network Error'), { isAxiosError: true }));

    await useAuthStore.getState().fetchMe();

    expect(keychain.password).toBe(saved('stale', 'r1'));
    expect(useAuthStore.getState().user).toBeNull();
  });

  test('server error during refresh -> keeps the session', async () => {
    keychain.password = saved('stale', 'r1');
    serverWithExpiry();
    jest
      .spyOn(axios, 'post')
      .mockRejectedValue(Object.assign(new Error('Bad Gateway'), { isAxiosError: true, response: { status: 502 } }));

    await useAuthStore.getState().fetchMe();

    expect(keychain.password).toBe(saved('stale', 'r1'));
    expect(useAuthStore.getState().bootError).not.toBeNull();
  });

  test('login stores both tokens', async () => {
    await useAuthStore.getState().setAuth(user as never, 'acc', 'ref');
    expect(JSON.parse(keychain.password!)).toEqual({ a: 'acc', r: 'ref' });
  });
});
