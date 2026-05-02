/**
 * Roster sort helper.
 *
 * Deterministic order: Leader, Co-Leader, Member, then unknown roles.
 * Within each role group, sort alphabetically by name (case-insensitive).
 *
 * Returns a new array; does not mutate the input.
 */

const ROLE_ORDER = { Leader: 0, 'Co-Leader': 1, Member: 2 };

export function sortRoster(roster) {
  if (!roster || !roster.length) return [];
  return [...roster].sort((a, b) => {
    const ra = ROLE_ORDER[a.role] ?? 3;
    const rb = ROLE_ORDER[b.role] ?? 3;
    if (ra !== rb) return ra - rb;
    return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
  });
}
