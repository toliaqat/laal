import 'server-only';

import { Resend } from 'resend';
import { formatMoney } from '@/components/ui';
import { APP_URL, EMAIL_FROM, RESEND_API_KEY } from '@/lib/env';

let _resend: Resend | null = null;
function resend(): Resend {
  if (!_resend) _resend = new Resend(RESEND_API_KEY());
  return _resend;
}

type SendResult = { ok: boolean; error?: string };

// Escape user-controlled values before embedding them in HTML email bodies.
// donorName/campaignTitle/beneficiaryName originate from donor input or
// organizer-entered campaign data, so interpolating them raw would allow
// stored HTML/script/phishing-link injection into recipients' inboxes.
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

async function send(to: string, subject: string, html: string): Promise<SendResult> {
  try {
    const { error } = await resend().emails.send({
      from: EMAIL_FROM(),
      to,
      subject,
      html,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }
}

function layout(body: string): string {
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a;line-height:1.6">
    <h2 style="font-weight:700">Laal</h2>
    ${body}
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
    <p style="font-size:12px;color:#888">Laal — every life is precious. laal.app</p>
  </div>`;
}

/** Invitation for someone to onboard/manage a partner organization. */
export function sendOrgInvite(params: {
  to: string;
  orgName?: string; // set when joining an existing org; absent => they create one
  inviterName?: string;
  token: string;
}): Promise<SendResult> {
  const acceptUrl = `${APP_URL()}/org/accept?token=${encodeURIComponent(params.token)}`;
  const who = params.inviterName ? esc(params.inviterName) : 'The Laal team';
  const what = params.orgName
    ? `manage <strong>${esc(params.orgName)}</strong> on Laal`
    : `set up your organization on Laal`;
  const body = `
    <p>Assalamu alaikum,</p>
    <p>${who} has invited you to ${what} — so your community can raise and
    receive support with dignity when a loved one passes.</p>
    <p>You'll complete your organization's profile and connect a bank account
    (securely, through Stripe) so funds from completed fundraisers can reach you.</p>
    <p><a href="${acceptUrl}"
      style="display:inline-block;background:#9a6a4f;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">Accept invitation</a></p>
    <p style="font-size:13px;color:#888">This link expires in 7 days. If you weren't expecting this, you can ignore it.</p>`;
  return send(params.to, 'You’re invited to join Laal as a partner organization', layout(body));
}

/** Notice to an organizer that their fundraiser passed review and is live. */
export function sendCampaignApproved(params: {
  to: string;
  organizerName?: string;
  campaignTitle: string;
  campaignSlug: string;
}): Promise<SendResult> {
  const body = `
    <p>Dear ${esc(params.organizerName ?? 'friend')},</p>
    <p>Your fundraiser <strong>${esc(params.campaignTitle)}</strong> has been
    reviewed and is now live. People can find it and contribute.</p>
    <p><a href="${APP_URL()}/campaigns/${encodeURIComponent(params.campaignSlug)}"
      style="display:inline-block;background:#9a6a4f;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">View your fundraiser</a></p>
    <p>Share the link with those who loved them — every share helps.</p>`;
  return send(
    params.to,
    `Your fundraiser is live — ${params.campaignTitle}`,
    layout(body),
  );
}

/** Notice to an organizer that their fundraiser was not approved. */
export function sendCampaignRejected(params: {
  to: string;
  organizerName?: string;
  campaignTitle: string;
}): Promise<SendResult> {
  const body = `
    <p>Dear ${esc(params.organizerName ?? 'friend')},</p>
    <p>Thank you for submitting <strong>${esc(params.campaignTitle)}</strong>.
    After review, we're not able to publish it in its current form.</p>
    <p>This is often something small we can resolve together. Reply to this
    email and our team will help you get it ready.</p>`;
  return send(
    params.to,
    `About your fundraiser — ${params.campaignTitle}`,
    layout(body),
  );
}

/**
 * Receipt copy, kept here rather than in the shared message catalogue: this
 * runs from the Stripe webhook, which has no request locale — the supporter's
 * locale rides along in the Checkout Session metadata instead.
 */
const RECEIPT_COPY = {
  en: {
    subject: (title: string) => `Thank you for supporting ${title}`,
    greeting: (name: string) => `Dear ${name}`,
    friend: 'friend',
    thanks: (amount: string, title: string) =>
      `Thank you for protecting someone precious. Your support of <strong>${amount}</strong> for <strong>${title}</strong> helps remind a family they are not alone.`,
    held: "Your contribution is held securely and delivered transparently to the people you're standing with.",
    dateLabel: 'Date',
    refLabel: 'Payment reference',
    link: 'See the fundraiser you supported',
  },
  ur: {
    subject: (title: string) => `${title} کی مدد کرنے کا شکریہ`,
    greeting: (name: string) => `محترم ${name}`,
    friend: 'دوست',
    thanks: (amount: string, title: string) =>
      `کسی عزیز کی حفاظت کرنے کا شکریہ۔ <strong>${title}</strong> کے لیے آپ کا <strong>${amount}</strong> کا تعاون ایک خاندان کو یاد دلاتا ہے کہ وہ تنہا نہیں۔`,
    held: 'آپ کا تعاون محفوظ طریقے سے رکھا جاتا ہے اور شفاف طریقے سے ان لوگوں تک پہنچایا جاتا ہے جن کے ساتھ آپ کھڑے ہیں۔',
    dateLabel: 'تاریخ',
    refLabel: 'ادائیگی کا حوالہ',
    link: 'جس مہم کی آپ نے مدد کی، اسے دیکھیں',
  },
} as const;

function receiptCopy(locale?: string) {
  return locale === 'ur' ? RECEIPT_COPY.ur : RECEIPT_COPY.en;
}

/** Receipt sent to a supporter after a successful contribution. */
export function sendDonationReceipt(params: {
  to: string;
  donorName?: string;
  /** Major units (e.g. 25) — formatted here with the shared money formatter. */
  amount: number;
  currency: string;
  /** Site locale carried through Stripe metadata; defaults to English. */
  locale?: string;
  campaignTitle: string;
  campaignSlug: string;
  /** Stripe PaymentIntent id, so support can trace the payment. */
  paymentReference?: string;
  /** Defaults to now; injectable for tests. */
  date?: Date;
}): Promise<SendResult> {
  const copy = receiptCopy(params.locale);
  const amount = formatMoney(params.amount, params.currency, params.locale);
  const when = new Intl.DateTimeFormat(
    params.locale === 'ur' ? 'ur-PK-u-nu-latn' : (params.locale ?? 'en'),
    { dateStyle: 'long' },
  ).format(params.date ?? new Date());
  const dir = params.locale === 'ur' ? 'rtl' : 'ltr';

  const body = `
    <div dir="${dir}">
    <p>${esc(copy.greeting(params.donorName ?? copy.friend))},</p>
    <p>${copy.thanks(esc(amount), esc(params.campaignTitle))}</p>
    <p>${copy.held}</p>
    <p style="font-size:13px;color:#888">${copy.dateLabel}: ${esc(when)}${
      params.paymentReference
        ? `<br />${copy.refLabel}: ${esc(params.paymentReference)}`
        : ''
    }</p>
    <p><a href="${APP_URL()}/${params.locale === 'ur' ? 'ur' : 'en'}/campaigns/${encodeURIComponent(params.campaignSlug)}">${copy.link}</a></p>
    </div>`;
  return send(params.to, copy.subject(params.campaignTitle), layout(body));
}

/** Confirmation sent to a donor when their donation is refunded (pre-release). */
export function sendRefundConfirmation(params: {
  to: string;
  donorName?: string;
  amount: string; // formatted e.g. "EUR 25.00"
  campaignTitle: string;
}): Promise<SendResult> {
  const body = `
    <p>Dear ${esc(params.donorName ?? 'friend')},</p>
    <p>Your donation of <strong>${esc(params.amount)}</strong> to
    <strong>${esc(params.campaignTitle)}</strong> has been refunded in full.</p>
    <p>The amount returns to your original payment method — usually within 5–10
    business days, depending on your bank.</p>
    <p>Thank you for your kindness. We hope you'll stand with another family when
    the time is right.</p>`;
  return send(
    params.to,
    `Your donation to ${params.campaignTitle} has been refunded`,
    layout(body),
  );
}

/** Notice sent when funds are released to the beneficiary. */
export function sendPayoutReleased(params: {
  to: string;
  beneficiaryName: string;
  amount: string;
  campaignTitle: string;
}): Promise<SendResult> {
  const body = `
    <p>Dear ${esc(params.beneficiaryName)},</p>
    <p>Your community stood beside you. Support totalling
    <strong>${esc(params.amount)}</strong> from <strong>${esc(params.campaignTitle)}</strong>
    is on its way to you.</p>
    <p>You matter, and people showed up for you.</p>`;
  return send(params.to, `Your community supported you — ${params.campaignTitle}`, layout(body));
}
