import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import * as eventTracking from '@/infrastructure/event-tracking'
import { useDetachCompileContext } from '@/shared/context/detach-compile-context'
import usePersistedState from '@/shared/hooks/use-persisted-state'
import { CompileTimeWarningUpgradePromptInner } from '@/features/pdf-preview/components/compile-time-warning-upgrade-prompt-inner'
import getMeta from '@/utils/meta'
import { CompileTimeoutChangingSoon } from './compile-time-changing-soon'

function CompileTimeWarningUpgradePrompt() {
  const { isProjectOwner, deliveryLatencies, compiling, showLogs, error } =
    useDetachCompileContext()

  const [showWarning, setShowWarning] = useState(false)
  const [showChangingSoon, setShowChangingSoon] = useState(false)
  const [dismissedUntilWarning, setDismissedUntilWarning] = usePersistedState<
    Date | undefined
  >(`has-dismissed-10s-compile-time-warning-until`)
  const { reducedTimeoutWarning } = getMeta('ol-compileSettings')
  const warningThreshold = reducedTimeoutWarning === 'enabled' ? 7 : 10

  const sharedSegmentation = useMemo(
    () => ({
      '10s-timeout-warning': reducedTimeoutWarning,
      'is-owner': isProjectOwner,
    }),
    [isProjectOwner, reducedTimeoutWarning]
  )

  const warningSegmentation = useMemo(
    () => ({
      content: 'warning',
      compileTime: warningThreshold,
      ...sharedSegmentation,
    }),
    [sharedSegmentation, warningThreshold]
  )

  const changingSoonSegmentation = useMemo(
    () => ({
      content: 'changes',
      compileTime: 10,
      ...sharedSegmentation,
    }),
    [sharedSegmentation]
  )

  const handleNewCompile = useCallback(
    (compileTime: number) => {
      setShowWarning(false)
      setShowChangingSoon(false)
      if (reducedTimeoutWarning === 'enabled' && compileTime > 10000) {
        setShowChangingSoon(true)
      } else if (compileTime > warningThreshold * 1000) {
        if (isProjectOwner) {
          if (
            !dismissedUntilWarning ||
            new Date(dismissedUntilWarning) < new Date()
          ) {
            setShowWarning(true)
            eventTracking.sendMB('compile-time-warning-displayed', {
              compileTime: warningThreshold,
              isProjectOwner,
            })
          }
        }
      }
    },
    [
      isProjectOwner,
      dismissedUntilWarning,
      reducedTimeoutWarning,
      warningThreshold,
    ]
  )

  const handleDismissWarning = useCallback(() => {
    eventTracking.sendMB('compile-time-warning-dismissed', {
      compileTime: warningThreshold,
      isProjectOwner,
    })
    eventTracking.sendMB('paywall-dismiss', {
      'paywall-type': 'compile-time-warning',
      content: 'warning',
      compileTime: warningThreshold,
      ...sharedSegmentation,
    })
    setShowWarning(false)
    const until = new Date()
    until.setDate(until.getDate() + 1) // 1 day
    setDismissedUntilWarning(until)
  }, [
    isProjectOwner,
    setDismissedUntilWarning,
    warningThreshold,
    sharedSegmentation,
  ])

  const handleDismissChangingSoon = useCallback(() => {
    eventTracking.sendMB('paywall-dismiss', {
      'paywall-type': 'compile-time-warning',
      compileTime: 10,
      content: 'changes',
      ...sharedSegmentation,
    })
    setShowChangingSoon(false)
  }, [sharedSegmentation])

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

  if (!showWarning && !showChangingSoon) {
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
      {showChangingSoon && (
        <CompileTimeoutChangingSoon
          isProjectOwner={isProjectOwner}
          handleDismissChangingSoon={handleDismissChangingSoon}
          segmentation={changingSoonSegmentation}
        />
      )}
    </div>
  )
}

export default memo(CompileTimeWarningUpgradePrompt)
