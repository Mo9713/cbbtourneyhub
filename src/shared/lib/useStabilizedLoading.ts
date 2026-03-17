import { useState, useEffect } from 'react'

/**
 * Smart Loading: Only shows a skeleton if the loading state persists 
 * longer than the threshold (e.g., 150ms). Prevents "flicker" on fast loads.
 */
export function useStabilizedLoading(isLoading: boolean, threshold = 150) {
  const [shouldShowSkeleton, setShouldShowSkeleton] = useState(false)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    if (isLoading) {
      // Only trigger the skeleton if we've been loading longer than the threshold
      timer = setTimeout(() => setShouldShowSkeleton(true), threshold)
    } else {
      // Data arrived! Hide skeleton immediately and kill the timer
      setShouldShowSkeleton(false)
    }

    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [isLoading, threshold])

  return shouldShowSkeleton
}