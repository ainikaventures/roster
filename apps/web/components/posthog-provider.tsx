'use client';

import * as React from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

// One-time init guarded against StrictMode double-invocation.
let initialized = false;
function ensureInit() {
  if (initialized || typeof window === 'undefined' || !KEY) return;
  posthog.init(KEY, {
    api_host: HOST,
    capture_pageview: false,
    persistence: 'localStorage+cookie',
  });
  initialized = true;
}

function PageviewTracker() {
  const pathname = usePathname();
  const params = useSearchParams();

  React.useEffect(() => {
    if (!KEY || typeof window === 'undefined') return;
    ensureInit();
    const search = params?.toString();
    const url = search ? `${pathname}?${search}` : pathname;
    posthog.capture('$pageview', { $current_url: window.location.origin + url });
  }, [pathname, params]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  if (!KEY) return <>{children}</>;
  return (
    <>
      <React.Suspense fallback={null}>
        <PageviewTracker />
      </React.Suspense>
      {children}
    </>
  );
}
