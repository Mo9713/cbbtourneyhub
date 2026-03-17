// src/shared/lib/useStabilizedLoading.ts
import { useState, useEffect } from 'react'

/**
 * Enforces a minimum display time for loading states to prevent UI flashing.
 * @param isLoading The actual loading state from React Query / Auth
 * @param minDuration Minimum time in ms to show the loading state (default 400ms)
 */
export function useStabilizedLoading(isLoading: boolean, minDuration = 400) {
  const [isStabilized, setIsStabilized] = useState(isLoading)

  useEffect(() => {
    let timeoutId: NodeJS.Timeout

    if (isLoading) {
      // If the real loading state is true, instantly show the skeleton
      setIsStabilized(true)
    } else {
      // If the real loading state finishes, enforce the minimum wait time
      timeoutId = setTimeout(() => {
        setIsStabilized(false)
      }, minDuration)
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [isLoading, minDuration])

  return isStabilized
}