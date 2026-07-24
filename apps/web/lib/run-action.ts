import { unstable_rethrow } from 'next/navigation';
import { ActionError, fail, type ActionState } from './action-result';

/**
 * Boundary wrapper for every server action body.
 *
 * - Rethrows Next.js control flow (redirect/notFound) — this MUST stay first
 *   in the catch, or every successful `redirect()` turns into an error alert.
 * - Converts {@link ActionError} from shared helpers into a returned `fail`.
 * - Logs anything else under the `[tag]` convention and returns `unexpected`,
 *   so users get a recoverable message instead of the framework crash page.
 */
export async function runAction(
  tag: string,
  fn: () => Promise<ActionState>,
): Promise<ActionState> {
  try {
    return await fn();
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof ActionError) {
      return fail(err.code, err.values, err.message);
    }
    console.error(`[${tag}]`, err);
    return fail('unexpected');
  }
}
