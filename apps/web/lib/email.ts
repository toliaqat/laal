import 'server-only';

import { Resend } from 'resend';
import { APP_URL, EMAIL_FROM, RESEND_API_KEY } from '@/lib/env';

let _resend: Resend | null = null;
function resend(): Resend {
  if (!_resend) _resend = new Resend(RESEND_API_KEY());
  return _resend;
}

type SendResult = { ok: boolean; error?: string };

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
    <h2 style="font-weight:700">Ashfaat</h2>
    ${body}
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
    <p style="font-size:12px;color:#888">Ashfaat — dignified memorial fundraising for expat families.</p>
  </div>`;
}

/** Receipt sent to a donor after a successful donation. */
export function sendDonationReceipt(params: {
  to: string;
  donorName?: string;
  amount: string; // formatted e.g. "€25.00"
  campaignTitle: string;
  campaignSlug: string;
}): Promise<SendResult> {
  const body = `
    <p>Dear ${params.donorName ?? 'friend'},</p>
    <p>Thank you for your donation of <strong>${params.amount}</strong> to
    <strong>${params.campaignTitle}</strong>.</p>
    <p>Your contribution is held securely and will be released to the verified
    beneficiary. We are grateful for your compassion.</p>
    <p><a href="${APP_URL()}/campaigns/${params.campaignSlug}">View the campaign</a></p>`;
  return send(params.to, `Your donation to ${params.campaignTitle}`, layout(body));
}

/** Notice sent when funds are released to the beneficiary. */
export function sendPayoutReleased(params: {
  to: string;
  beneficiaryName: string;
  amount: string;
  campaignTitle: string;
}): Promise<SendResult> {
  const body = `
    <p>Dear ${params.beneficiaryName},</p>
    <p>Funds totalling <strong>${params.amount}</strong> from
    <strong>${params.campaignTitle}</strong> have been released and are on their
    way to your account.</p>`;
  return send(params.to, `Funds released — ${params.campaignTitle}`, layout(body));
}
