import { redirect } from 'next/navigation';

// Stripe sends the user here after the hosted onboarding flow. The
// account.updated webhook flips stripe_onboarding_complete, so we just land them
// back in the portal where the current status is shown.
export default function OnboardingReturn() {
  redirect('/org');
}
