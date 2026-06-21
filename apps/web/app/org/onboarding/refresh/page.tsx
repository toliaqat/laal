import { redirect } from 'next/navigation';

// Stripe sends the user here if the onboarding link expired before completion.
// Send them back to the portal where they can start a fresh onboarding link.
export default function OnboardingRefresh() {
  redirect('/org');
}
