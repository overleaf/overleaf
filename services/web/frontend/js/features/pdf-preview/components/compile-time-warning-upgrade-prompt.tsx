import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import * as eventTracking from '@/infrastructure/event-tracking'
import { useDetachCompileContext } from '@/shared/context/detach-compile-context'
import usePersistedState from '@/shared/hooks/use-persisted-state'
import { CompileTimeWarningUpgradePromptInner } from '@/features/pdf-preview/components/compile-time-warning-upgrade-prompt-inner'
import getMeta from '@/utils/meta'

function CompileTimeWarningUpgradePrompt() {
  const { isProjectOwner, deliveryLatencies, compiling, showLogs, error } =
    useDetachCompileContext()

  const [showWarning, setShowWarning] = useState(false)
  const [dismissedUntilWarning, setDismissedUntilWarning] = usePersistedState<
    Date | undefined
  >(`has-dismissed-10s-compile-time-warning-until`)

  const warningSegmentation = useMemo(
    () => ({
      content: 'warning',
      compileTime: 7,
      isProjectOwner,
    }),
    [isProjectOwner]
  )

  const handleNewCompile = useCallback(
    (compileTime: number) => {
      setShowWarning(false)
      if (compileTime > 7000) {
        if (isProjectOwner) {
          if (
            !dismissedUntilWarning ||
            new Date(dismissedUntilWarning) < new Date()
          ) {
            setShowWarning(true)
            eventTracking.sendMB('compile-time-warning-displayed', {
              compileTime: 7,
              isProjectOwner,
            })
          }
        }
      }
    },
    [isProjectOwner, dismissedUntilWarning]
  )

  const handleDismissWarning = useCallback(() => {
    eventTracking.sendMB('compile-time-warning-dismissed', {
      compileTime: 7,
      isProjectOwner,
    })
    eventTracking.sendMB('paywall-dismiss', {
      'paywall-type': 'compile-time-warning',
      content: 'warning',
      compileTime: 7,
      isProjectOwner,
    })
    setShowWarning(false)
    const until = new Date()
    until.setDate(until.getDate() + 1) // 1 day
    setDismissedUntilWarning(until)
  }, [isProjectOwner, setDismissedUntilWarning])

  useEffect(() => {
    if (compiling || error || showLogs) return
    handleNewCompile(deliveryLatencies.compileTimeServerE2E)
  }, [compiling, error, showLogs, deliveryLatencies, handleNewCompile])

  if (!getMeta('ol-ExposedSettings').enableSubscriptions) {
    return null
  }

  if (
    compiling ||
    error ||
    showLogs ||
    !deliveryLatencies.compileTimeServerE2E
  ) {
    return null
  }

  if (!showWarning) {
    return null
  }

  return (
    <div>
      {showWarning && isProjectOwner && (
        <CompileTimeWarningUpgradePromptInner
          handleDismissWarning={handleDismissWarning}
          segmentation={warningSegmentation}
        />
      )}
    </div>
  )
}

export default memo(CompileTimeWarningUpgradePrompt)
