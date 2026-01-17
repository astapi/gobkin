import { useState, useEffect } from 'react'

interface UseCurrentTimeOptions {
  enabled: boolean
  intervalMs?: number
}

export const useCurrentTime = ({ enabled, intervalMs = 1000 }: UseCurrentTimeOptions) => {
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    if (!enabled) {
      return
    }

    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, intervalMs)

    return () => clearInterval(timer)
  }, [enabled, intervalMs])

  return currentTime
}
