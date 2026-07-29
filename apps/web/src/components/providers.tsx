'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, useTheme } from 'next-themes';
import { useState } from 'react';
import { Toaster } from 'sonner';

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={resolvedTheme === 'light' ? 'light' : 'dark'}
      richColors
      closeButton
      position="top-right"
      toastOptions={{
        className: 'font-sans',
      }}
    />
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <QueryClientProvider client={client}>
        {children}
        <ThemedToaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
