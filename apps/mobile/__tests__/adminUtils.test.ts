import { filterUsers, filterWorkspaces, isValidSlug, slugify } from '../src/features/admin/utils';
import { initials } from '../src/lib/utils';
import type { AdminUser, AdminWorkspace } from '../src/features/admin/types';

const user = (over: Partial<AdminUser>) => ({ displayName: 'Ann Lee', username: 'ann', email: 'ann@x.io', systemRole: 'USER', ...over }) as AdminUser;
const ws = (over: Partial<AdminWorkspace>) => ({ name: 'Acme', slug: 'acme', ...over }) as AdminWorkspace;

test('slugify produces slugs the server accepts', () => {
  expect(slugify('  Acme Inc. 2026! ')).toBe('acme-inc-2026');
  expect(slugify('---')).toBe('');
  expect(isValidSlug(slugify('Acme Inc.'))).toBe(true);
  expect(isValidSlug('a')).toBe(false);
  expect(isValidSlug('Bad Slug')).toBe(false);
});

test('filterUsers matches query across fields and role filter', () => {
  const users = [user({ id: '1' }), user({ id: '2', displayName: 'Bo', username: 'bo', email: 'bo@y.io', systemRole: 'SUPER_ADMIN' })];
  expect(filterUsers(users, '', 'ALL')).toHaveLength(2);
  expect(filterUsers(users, '  Y.IO ', 'ALL').map(u => u.id)).toEqual(['2']);
  expect(filterUsers(users, '', 'SUPER_ADMIN').map(u => u.id)).toEqual(['2']);
  expect(filterUsers(users, 'ann', 'SUPER_ADMIN')).toHaveLength(0);
});

test('filterWorkspaces matches owner and tolerates a missing owner', () => {
  const list = [ws({ id: '1' }), ws({ id: '2', name: 'Zed', slug: 'zed', owner: { id: 'o', email: 'ceo@zed.io', username: 'c', displayName: 'Cee' } })];
  expect(filterWorkspaces(list, 'ceo@').map(w => w.id)).toEqual(['2']);
  expect(filterWorkspaces(list, 'acme').map(w => w.id)).toEqual(['1']);
});

test('initials', () => {
  expect(initials('Ann Lee')).toBe('AL');
  expect(initials('bo')).toBe('B');
  expect(initials('  ')).toBe('?');
});
