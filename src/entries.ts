// The repair entry: five prompts, answered privately. Pure data + validation
// so the form logic is testable without rendering.

export const PROMPTS = [
  {
    key: 'happened',
    title: 'What happened?',
    hint: 'Just one sentence — the moment itself, not the whole story.',
  },
  {
    key: 'felt',
    title: 'What did you feel?',
    hint: 'Underneath the first reaction, what was really there?',
  },
  {
    key: 'needed',
    title: 'What did you need?',
    hint: 'In that moment — what would have helped?',
  },
  {
    key: 'partnerNeeded',
    title: 'What do you think your partner needed?',
    hint: 'Your best guess at their side of it.',
  },
  {
    key: 'differently',
    title: 'What is one thing you would do differently?',
    hint: 'Small counts. One thing is enough.',
  },
] as const;

export type PromptKey = (typeof PROMPTS)[number]['key'];

export type EntryAnswers = Record<PromptKey, string>;

// Suggested topics for tagging a repair. The tag is the user's choice — these
// are starting points, and the tag itself is stored/sent only in sealed form.
export const TOPICS = [
  'communication',
  'chores',
  'money',
  'family',
  'plans',
  'time together',
  'other',
] as const;

export interface RepairEntry {
  id: string;
  answers: EntryAnswers;
  tag: string; // topic chosen when the entry was written
  createdAt: number; // when it was submitted (ms epoch)
  uploaded: boolean; // false while queued for the relay (offline)
}

export function emptyAnswers(): EntryAnswers {
  return { happened: '', felt: '', needed: '', partnerNeeded: '', differently: '' };
}

/** Keys of prompts that still need an answer. Empty array → ready to submit. */
export function missingAnswers(answers: EntryAnswers): PromptKey[] {
  return PROMPTS.filter((p) => answers[p.key].trim().length === 0).map((p) => p.key);
}

export function isComplete(answers: EntryAnswers): boolean {
  return missingAnswers(answers).length === 0;
}
