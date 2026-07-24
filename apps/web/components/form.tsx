'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import type { ActionState } from '@/lib/action-result';
import { Alert } from '@/components/ui';

type FormAction = (
  prev: ActionState,
  formData: FormData,
) => Promise<ActionState>;

/**
 * Renders the outcome of an {@link ActionState}: the translated error for a
 * failure (from the `errors.*` namespace), or an optional success message.
 * `showDetail` additionally renders the raw underlying message — admin
 * surfaces only; never enable it on public forms.
 */
export function FormAlert({
  state,
  successMessage,
  showDetail,
}: {
  state: ActionState;
  successMessage?: string;
  showDetail?: boolean;
}) {
  const t = useTranslations('errors');
  if (!state) return null;
  if (state.ok) {
    const message = state.message ?? successMessage;
    return message ? <Alert tone="success">{message}</Alert> : null;
  }
  return (
    <Alert tone="danger">
      {t(state.code, state.values)}
      {showDetail && state.detail ? (
        <span className="small muted"> — {state.detail}</span>
      ) : null}
    </Alert>
  );
}

/**
 * Submit button with pending state via useFormStatus — must be rendered
 * inside the form element it submits. Mirrors the ui.tsx Button classes.
 */
export function SubmitButton({
  children,
  pendingLabel,
  variant = 'primary',
  size,
  block,
  style,
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'sm';
  block?: boolean;
  style?: CSSProperties;
}) {
  const { pending } = useFormStatus();
  const cls = `btn btn-${variant}${size === 'sm' ? ' btn-sm' : ''}${
    block ? ' btn-block' : ''
  }`;
  return (
    <button type="submit" className={cls} disabled={pending} style={style}>
      {pending ? (pendingLabel ?? children) : children}
    </button>
  );
}

/**
 * Form wrapper for server-component pages: wires useActionState around a
 * server action passed as a prop and renders the outcome below the children.
 * The children stay server-rendered; use {@link SubmitButton} inside for
 * pending state.
 */
export function ActionForm({
  action,
  children,
  className,
  style,
  successMessage,
  showDetail,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  successMessage?: string;
  showDetail?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={className} style={style}>
      {children}
      <FormAlert
        state={state}
        successMessage={successMessage}
        showDetail={showDetail}
      />
    </form>
  );
}
