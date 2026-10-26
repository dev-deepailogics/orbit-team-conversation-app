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
