'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Field } from '@/components/ui';
import { downscaleImage } from '@/lib/client-image';

// Keep in sync with MAX_BYTES in lib/cover-image.ts.
const SERVER_MAX_BYTES = 20 * 1024 * 1024;

/**
 * Optional cover-image picker with a live local preview. Picked files are
 * downscaled client-side (phone photos shrink from ~10MB to a few hundred KB)
 * before submit; the server still re-encodes and validates whatever arrives.
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
  const [tooLarge, setTooLarge] = useState(false);

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
          onChange={async (e) => {
            const input = e.target;
            let file = input.files?.[0] ?? null;

            // Shrink big photos before they ever leave the device. On failure
            // keep the original; the server cap is the backstop.
            if (file) {
              const small = await downscaleImage(file);
              if (small && small.size < file.size) {
                const dt = new DataTransfer();
                dt.items.add(small);
                try {
                  input.files = dt.files;
                  file = small;
                } catch {
                  // Ancient browser: submit the original.
                }
              }
            }

            setTooLarge(Boolean(file && file.size > SERVER_MAX_BYTES));
            setPreview((prev) => {
              if (prev) URL.revokeObjectURL(prev);
              return file ? URL.createObjectURL(file) : null;
            });
            if (file) setRemove(false);
          }}
        />

        {tooLarge && (
          <span className="error-text">
            {t('cover.tooLarge', { maxMb: SERVER_MAX_BYTES / (1024 * 1024) })}
          </span>
        )}

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
