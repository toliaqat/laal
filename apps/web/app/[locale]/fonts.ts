import { Noto_Nastaliq_Urdu, Noto_Naskh_Arabic } from 'next/font/google';

/**
 * Urdu webfonts, loaded via next/font and exposed as CSS variables.
 *
 * Nastaliq is the calligraphic display face used for headings/brand; Naskh is
 * a clearer face for body/UI text where Nastaliq's line-height is impractical.
 * globals.css swaps `--serif`/`--sans` to these under `[dir="rtl"]`.
 */
export const urduSerif = Noto_Nastaliq_Urdu({
  subsets: ['arabic'],
  weight: ['400', '600', '700'],
  variable: '--font-urdu-serif',
  display: 'swap',
});

export const urduSans = Noto_Naskh_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-urdu-sans',
  display: 'swap',
});
