// src/lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            60_000,   // 1 min — data considered fresh
      gcTime:               300_000,  // 5 min — cache retained after unmount
      retry:                1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Mutations never retry — pick/game writes must be explicit
      retry: 0,
    },
  },
})