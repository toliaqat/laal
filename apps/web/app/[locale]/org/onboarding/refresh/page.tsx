import { redirect } from '@/i18n/navigation';

// Stripe sends the user here if the onboarding link expired before completion.
// Send them back to the portal where they can start a fresh onboarding link.
export default async function OnboardingRefresh({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: '/org', locale });
}
