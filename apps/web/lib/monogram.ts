/**
 * Up-to-two-letter monogram of a person's name, for the memorial fallback shown
 * wherever a family has not shared a photo of their loved one (see
 * components/memorial-photo.tsx). Mirrors `initials()` in
 * apps/mobile/lib/theme.ts so web and mobile surfaces read the same — if you
 * change one, change the other.
 *
 * - Two or more words: first letter of each of the first two ("Ahmed Khan" → "AK").
 * - One word: its first two letters ("Ayesha" → "AY").
 * - Blank: a quiet middle dot, never an empty circle.
 *
 * Deliberately free of `next` so it stays unit-testable under plain `node --test`.
 */
export function monogram(name: string | null | undefined): string {
  const [first, second] = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!first) return '·';
  if (second) return (first[0]! + second[0]!).toLocaleUpperCase();
  return first.slice(0, 2).toLocaleUpperCase();
}
