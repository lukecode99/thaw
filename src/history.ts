// History and patterns: pure data helpers so the views stay thin. Everything
// here works on data that already lives decrypted in memory — nothing in this
// module talks to the network, by design.
import type { EntryAnswers } from './entries';

/** One past repair, joined from local records: our side, and — if the reveal
 *  happened on this phone — the partner's side cached under our own key. */
export interface HistoryRepair {
  id: string;
  createdAt: number;
  tag: string;
  mine: EntryAnswers;
  myClosing: string | null;
  theirs: EntryAnswers | null;
  theirClosing: string | null;
}

/** Shown above the tag frequency view. Recurring topics are the norm, not a
 *  failure — long-running research puts about 69% of couples' recurring
 *  disagreements down to lasting differences that never fully go away. */
export const PATTERNS_FRAMING =
  'Seeing the same topic more than once is normal — research on long-term ' +
  'couples suggests around 69% of recurring disagreements are about lasting ' +
  'differences that never fully go away. The topic coming back is not the ' +
  'problem. What changes over time is how well you repair.';

export interface TagCount {
  tag: string;
  count: number;
}

/** Tags by frequency, most common first (ties: alphabetical). */
export function tagFrequency(repairs: readonly HistoryRepair[]): TagCount[] {
  const counts = new Map<string, number>();
  for (const repair of repairs) {
    if (!repair.tag) continue;
    counts.set(repair.tag, (counts.get(repair.tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

const PREVIEW_LENGTH = 64;

/** One-line preview for the history list: the start of "what happened". */
export function previewOf(answers: EntryAnswers): string {
  const line = answers.happened.trim().replace(/\s+/g, ' ');
  return line.length > PREVIEW_LENGTH ? `${line.slice(0, PREVIEW_LENGTH - 1)}…` : line;
}

export function formatDay(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
