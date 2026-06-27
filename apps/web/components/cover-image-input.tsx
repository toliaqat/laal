'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Field } from '@/components/ui';

/**
 * Optional cover-image picker with a live local preview. The preview is purely
 * cosmetic — the server re-encodes and validates whatever is submitted.
 */
export function CoverImageInput({
  currentUrl,
  deceasedName,
  allowRemove = false,
}: {
  /** Existing stored image (edit flow), shown until a new file is picked. */
  currentUrl?: string | null;
  deceasedName?: string;
  /** Render a "remove current photo" checkbox (edit flow only). */
  allowRemove?: boolean;
}) {
  const t = useTranslations('start');
  const [preview, setPreview] = useState<string | null>(null);
  const [remove, setRemove] = useState(false);

  // Revoke the object URL when it changes/unmounts to avoid leaking memory.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const shown = preview ?? (remove ? null : currentUrl) ?? null;

  return (
    <Field
      label={t('cover.label')}
      hint={t('cover.hint')}
    >
      <div className="stack" style={{ gap: '0.6rem' }}>
        {shown && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shown}
            alt={deceasedName ? t('cover.photoOfAlt', { name: deceasedName }) : t('cover.photoAlt')}
            style={{
              width: '100%',
              maxHeight: 280,
              objectFit: 'cover',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--line)',
            }}
          />
        )}

        <input
          id="cover_image"
          name="cover_image"
          className="input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            setPreview((prev) => {
              if (prev) URL.revokeObjectURL(prev);
              return file ? URL.createObjectURL(file) : null;
            });
            if (file) setRemove(false);
          }}
        />

        {allowRemove && currentUrl && !preview && (
          <label className="row small" style={{ gap: '0.4rem' }}>
            <input
              type="checkbox"
              name="remove_cover"
              value="1"
              checked={remove}
              onChange={(e) => setRemove(e.target.checked)}
            />
            <span>{t('cover.remove')}</span>
          </label>
        )}
      </div>
    </Field>
  );
}
