import { redirect } from '@/i18n/navigation';

// Stripe sends the user here after the hosted onboarding flow. The
// account.updated webhook flips stripe_onboarding_complete, so we just land them
// back in the portal where the current status is shown.
export default async function OnboardingReturn({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: '/org', locale });
}
