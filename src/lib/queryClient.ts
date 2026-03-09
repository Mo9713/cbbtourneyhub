// src/lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:           1000 * 60,      // 1 min — don't refetch on every mount
      gcTime:              1000 * 60 * 5,  // 5 min — keep unused cache alive
      retry:               1,
      refetchOnWindowFocus: false,         // realtime handles freshness
    },
  },
})