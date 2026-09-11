'use client';

import { useEffect, useState } from 'react';
import styles from './campaign.module.css';

/**
 * The mobile "Help Now" bar that follows the reader down the fundraiser page.
 *
 * Two things it must not do:
 * - Detach. As a `position: sticky` element it could only stick inside its
 *   containing block, so near the foot of the page it un-stuck ~230px above the
 *   viewport and left an empty band above the footer. It is `position: fixed`
 *   now (see campaign.module.css), which has no such boundary.
 * - Shout over the real form. Once the donate form is on screen the bar is a
 *   duplicate CTA sitting directly on top of the actual submit button, so it
 *   steps aside: `#help` is watched, and the bar fades out while it is visible.
 *
 * Hiding is done with `visibility: hidden` (see the module CSS), which takes the
 * duplicate link out of the tab order and the accessibility tree as well as out
 * of sight. Without JavaScript the bar simply stays visible — the pre-hydration
 * state is "shown", and it is an anchor to an on-page target either way.
 */
export function StickyHelp({ label }: { label: string }) {
  const [atForm, setAtForm] = useState(false);

  useEffect(() => {
    const form = document.getElementById('help');
    if (!form || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([entry]) => setAtForm(Boolean(entry?.isIntersecting)),
      // A sliver of the form is enough: the moment a supporter can see the real
      // control, the floating copy of it is noise.
      { rootMargin: '0px 0px -80px 0px', threshold: 0 },
    );
    io.observe(form);
    return () => io.disconnect();
  }, []);

  return (
    <div className={styles.stickyHelp} data-hidden={atForm || undefined}>
      <a href="#help" className="btn btn-primary btn-block">
        {label}
      </a>
    </div>
  );
}
