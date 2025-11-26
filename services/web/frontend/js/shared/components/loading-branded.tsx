import { useEffect, useState, useRef } from 'react'

type LoadingBrandedTypes = {
  loadProgress: number // Percentage
  label?: string
  hasError?: boolean
}

export default function LoadingBranded({
  loadProgress,
  label,
  hasError = false,
}: LoadingBrandedTypes) {
  // Smooth progress interpolation for visual polish
  const [displayProgress, setDisplayProgress] = useState(0)
  const animationRef = useRef<number>()
  const targetRef = useRef(loadProgress)

  useEffect(() => {
    targetRef.current = loadProgress

    const animate = () => {
      setDisplayProgress(prev => {
        const target = targetRef.current
        const diff = target - prev

        // If we're close enough, snap to target
        if (Math.abs(diff) < 0.5) {
          return target
        }

        // Smooth interpolation - faster acceleration, gentle deceleration
        // This creates a satisfying "ease-out" feel
        const step = diff * 0.12
        return prev + step
      })

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [loadProgress])

  // Ensure minimum visible progress for better UX
  // Show a small amount so users know something is happening
  const visualProgress = Math.max(displayProgress, 8)

  return (
    <>
      <div className="loading-screen-brand-container">
        <div
          className="loading-screen-brand"
          style={
            {
              '--progress': `${visualProgress}%`,
            } as React.CSSProperties
          }
        />
      </div>

      {!hasError && (
        <div className="h3 loading-screen-label" aria-live="polite">
          {label}
          <span className="loading-screen-ellip" aria-hidden="true">
            .
          </span>
          <span className="loading-screen-ellip" aria-hidden="true">
            .
          </span>
          <span className="loading-screen-ellip" aria-hidden="true">
            .
          </span>
        </div>
      )}
    </>
  )
}
