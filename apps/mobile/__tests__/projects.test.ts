import type { WorkspaceMember } from '@orbit/types';
import { formatYmd, monthGrid, shiftMonth, toYmd } from '../src/lib/date';
import { markdownToHtml } from '../src/lib/markdownToHtml';
import { useProjectStore } from '../src/features/projects/store';
import {
  checklistProgress,
  dueToInput,
  filterTickets,
  getAssignees,
  getLabels,
  isOverdue,
  moveItem,
  moveTicketInColumns,
  parseDueInput,
  projectMembers,
} from '../src/features/projects/utils';
import type { Project, ProjectColumn, Ticket } from '../src/features/projects/types';

const t = (id: string, columnId: string, over: Partial<Ticket> = {}) =>
  ({ id, columnId, projectId: 'p1', title: `Ticket ${id}`, priority: 'MEDIUM', ...over } as Ticket);
const col = (id: string, tickets: Ticket[]) => ({ id, projectId: 'p1', name: id, tickets } as ProjectColumn);

test('parseDueInput accepts real dates, clears on empty, rejects junk', () => {
  expect(parseDueInput('')).toBeNull();
  expect(parseDueInput('2026-03-01')).toBe('2026-03-01T00:00:00.000Z');
  expect(parseDueInput('2026-02-30')).toBeUndefined();
  expect(parseDueInput('03/01/2026')).toBeUndefined();
  expect(dueToInput('2026-03-01T00:00:00.000Z')).toBe('2026-03-01');
});

test('isOverdue compares by UTC day', () => {
  const now = new Date('2026-03-02T10:00:00Z');
  expect(isOverdue('2026-03-01T00:00:00.000Z', now)).toBe(true);
  expect(isOverdue('2026-03-02T00:00:00.000Z', now)).toBe(false);
  expect(isOverdue(null, now)).toBe(false);
});

test('tolerates messy imported JSON fields', () => {
  expect(getLabels({ labels: ['a', { name: 'b' }, { text: 'c' }, null, 5, ''] } as Ticket)).toEqual(['a', 'b', 'c']);
  expect(getLabels({ labels: 'oops' } as unknown as Ticket)).toEqual([]);
  expect(checklistProgress([{ id: '1', text: 'x', completed: true }, { id: '2', text: 'y', completed: false }])).toEqual({
    done: 1,
    total: 2,
  });
});

test('filterTickets matches title, ref and assignee', () => {
  const list = [t('1', 'a', { title: 'Fix login' }), t('2', 'a', { customId: 'ORB-7' })];
  expect(filterTickets(list, 'login')).toHaveLength(1);
  expect(filterTickets(list, 'orb-7')[0].id).toBe('2');
  expect(filterTickets(list, '  ')).toHaveLength(2);
});

test('moveTicketInColumns moves across and within columns, clamping the index', () => {
  const cols = [col('a', [t('1', 'a'), t('2', 'a')]), col('b', [t('3', 'b')])];
  const across = moveTicketInColumns(cols, cols[0].tickets![0], 'b', 99);
  expect(across[0].tickets!.map(x => x.id)).toEqual(['2']);
  expect(across[1].tickets!.map(x => x.id)).toEqual(['3', '1']);
  expect(across[1].tickets![1].columnId).toBe('b');
  const within = moveTicketInColumns(cols, cols[0].tickets![0], 'a', 1);
  expect(within[0].tickets!.map(x => x.id)).toEqual(['2', '1']);
});

test('moveItem ignores out-of-range moves', () => {
  expect(moveItem([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
  expect(moveItem([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
  expect(moveItem([1, 2, 3], 2, 3)).toEqual([1, 2, 3]);
});

test('store applies realtime events to the open project only', () => {
  const s = () => useProjectStore.getState();
  useProjectStore.setState({
    current: { id: 'p1', name: 'P', columns: [col('a', [t('1', 'a')]), col('b', [])] } as Project,
  });
  s().addTicket(t('1', 'a')); // duplicate from our own POST + socket echo
  s().addTicket(t('9', 'b', { projectId: 'other' })); // other project: ignored
  s().addTicket(t('2', 'b'));
  expect(s().current!.columns!.map(c => c.tickets!.length)).toEqual([1, 1]);
  s().updateTicket(t('1', 'b', { title: 'Renamed' })); // column change inside an update relocates it
  expect(s().current!.columns![0].tickets).toHaveLength(0);
  expect(s().current!.columns![1].tickets!.map(x => x.title)).toEqual(['Ticket 2', 'Renamed']);
  s().setColumnOrder('p1', ['b']); // unmentioned columns are kept
  expect(s().current!.columns!.map(c => c.id)).toEqual(['b', 'a']);
  s().removeProject('p1');
  expect(s().current).toBeNull();
});

test('projectMembers only offers people assigned to the project, matched by uid or name', () => {
  const members = [
    { userId: 'u1', user: { displayName: 'Ann Lee' } },
    { userId: 'u2', user: { displayName: 'Bo Chan' } },
    { userId: 'u3', user: { displayName: 'Cy Doe' } },
  ] as WorkspaceMember[];
  const project = { assignedEmployees: [{ uid: 'u1', name: 'Ann Lee' }, { name: 'Bo Chan' }, { uid: 'gone', name: 'Ex Member' }, { uid: 'u1', name: 'Ann Lee' }] };
  expect(projectMembers(project, members)).toEqual([
    { uid: 'u1', name: 'Ann Lee' },
    { uid: 'u2', name: 'Bo Chan' },
  ]);
  expect(projectMembers({ assignedEmployees: null }, members)).toEqual([]);
  expect(projectMembers(null, members)).toEqual([]);
});

test('getAssignees prefers the multi-assign list and falls back to the single assignee', () => {
  expect(getAssignees({ assignees: [{ uid: 'a', name: 'A' }, null, { nope: 1 }] } as unknown as Ticket)).toEqual([{ uid: 'a', name: 'A' }]);
  expect(getAssignees({ assignees: [], assignee: { id: 'b', displayName: 'B' } } as Ticket)).toEqual([{ uid: 'b', name: 'B' }]);
  expect(getAssignees({} as Ticket)).toEqual([]);
});

test('calendar grid covers the month in whole weeks and shifts across years', () => {
  const feb = monthGrid(2026, 1); // Feb 2026 starts on a Sunday and has 28 days
  expect(feb).toHaveLength(4);
  expect(feb[0][0]).toBe(1);
  expect(feb[3][6]).toBe(28);
  expect(monthGrid(2026, 2)[0]).toEqual([1, 2, 3, 4, 5, 6, 7]); // Mar 2026 also starts on a Sunday
  expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
  expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
  expect(toYmd(2026, 2, 5)).toBe('2026-03-05');
  expect(formatYmd('2026-03-05T00:00:00.000Z')).toBe('Mar 5, 2026');
});

test('markdownToHtml feeds the rich editor and escapes raw html', () => {
  expect(markdownToHtml('')).toBe('');
  expect(markdownToHtml('**bold** and *it*')).toContain('<strong>bold</strong>');
  expect(markdownToHtml('- a\n- b')).toContain('<li>a</li>');
  expect(markdownToHtml('```\nx = 1\ny = 2\n```')).toBe('<codeblock><p>x = 1</p><p>y = 2</p></codeblock>');
  expect(markdownToHtml('<script>alert(1)</script>')).not.toContain('<script>');
});
