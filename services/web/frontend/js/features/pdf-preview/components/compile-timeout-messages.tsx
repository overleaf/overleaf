import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import * as eventTracking from '@/infrastructure/event-tracking'
import { useDetachCompileContext } from '@/shared/context/detach-compile-context'
import usePersistedState from '@/shared/hooks/use-persisted-state'
import { CompileTimeoutWarning } from '@/features/pdf-preview/components/compile-timeout-warning'
import { CompileTimeoutChangingSoon } from '@/features/pdf-preview/components/compile-timeout-changing-soon'

function CompileTimeoutMessages() {
  const {
    showNewCompileTimeoutUI,
    isProjectOwner,
    deliveryLatencies,
    compiling,
    showLogs,
    error,
  } = useDetachCompileContext()

  const [showWarning, setShowWarning] = useState(false)
  const [showChangingSoon, setShowChangingSoon] = useState(false)
  const [dismissedUntilWarning, setDismissedUntilWarning] = usePersistedState<
    Date | undefined
  >(`has-dismissed-10s-compile-time-warning-until`)

  const segmentation = useMemo(() => {
    return {
      newCompileTimeout: showNewCompileTimeoutUI,
      isProjectOwner,
    }
  }, [showNewCompileTimeoutUI, isProjectOwner])

  const handleNewCompile = useCallback(
    compileTime => {
      setShowWarning(false)
      setShowChangingSoon(false)
      if (compileTime > 20000) {
        if (showNewCompileTimeoutUI === 'changing') {
          setShowChangingSoon(true)
          eventTracking.sendMB('compile-time-warning-displayed', {
            time: 20,
            ...segmentation,
          })
        }
      } else if (compileTime > 10000) {
        setShowChangingSoon(false)
        if (
          (isProjectOwner && showNewCompileTimeoutUI === 'active') ||
          showNewCompileTimeoutUI === 'changing'
        ) {
          if (
            !dismissedUntilWarning ||
            new Date(dismissedUntilWarning) < new Date()
          ) {
            setShowWarning(true)
            eventTracking.sendMB('compile-time-warning-displayed', {
              time: 10,
              ...segmentation,
            })
          }
        }
      }
    },
    [
      isProjectOwner,
      showNewCompileTimeoutUI,
      dismissedUntilWarning,
      segmentation,
    ]
  )

  const handleDismissWarning = useCallback(() => {
    eventTracking.sendMB('compile-time-warning-dismissed', {
      time: 10,
      ...segmentation,
    })
    setShowWarning(false)
    const until = new Date()
    until.setDate(until.getDate() + 1) // 1 day
    setDismissedUntilWarning(until)
  }, [setDismissedUntilWarning, segmentation])

  const handleDismissChangingSoon = useCallback(() => {
    eventTracking.sendMB('compile-time-warning-dismissed', {
      time: 20,
      ...segmentation,
    })
  }, [segmentation])

  useEffect(() => {
    if (compiling || error || showLogs) return
    handleNewCompile(deliveryLatencies.compileTimeServerE2E)
  }, [compiling, error, showLogs, deliveryLatencies, handleNewCompile])

  if (!window.ExposedSettings.enableSubscriptions) {
    return null
  }

  if (compiling || error || showLogs) {
    return null
  }

  if (!showWarning && !showChangingSoon) {
    return null
  }

  // if showWarning is true then the 10s warning is shown
  // and if showChangingSoon is true then the 20s-60s should show

  return (
    <div>
      {showWarning && isProjectOwner && (
        <CompileTimeoutWarning
          showNewCompileTimeoutUI={showNewCompileTimeoutUI}
          handleDismissWarning={handleDismissWarning}
        />
      )}
      {showChangingSoon && (
        <CompileTimeoutChangingSoon
          isProjectOwner={isProjectOwner}
          handleDismissChangingSoon={handleDismissChangingSoon}
        />
      )}
    </div>
  )
}

export default memo(CompileTimeoutMessages)
