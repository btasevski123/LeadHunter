import { redirect } from 'next/navigation';

/** Discovery lives on Companies now. */
export default function DiscoveryRedirectPage() {
  redirect('/companies');
}
