import { memo, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDetachCompileContext } from '@/shared/context/detach-compile-context'
import MaterialIcon from '@/shared/components/material-icon'
import OLTooltip from '@/shared/components/ol/ol-tooltip'

function PdfCompileTime() {
  const { t } = useTranslation()
  const { compiling, deliveryLatencies } = useDetachCompileContext()

  const startRef = useRef<number | null>(null)
  const [elapsedMs, setElapsedMs] = useState<number | null>(null)

  useEffect(() => {
    if (!compiling) {
      startRef.current = null
      return
    }
    startRef.current = performance.now()
    setElapsedMs(0)
    const intervalId = window.setInterval(() => {
      if (startRef.current !== null) {
        setElapsedMs(performance.now() - startRef.current)
      }
    }, 100)
    return () => {
      window.clearInterval(intervalId)
    }
  }, [compiling])

  const ms = compiling
    ? (elapsedMs ?? 0)
    : deliveryLatencies?.compileTimeClientE2E
  if (ms == null) {
    return null
  }

  const seconds = (ms / 1000).toFixed(1)

  return (
    <OLTooltip
      id="pdf-compile-time"
      description={t('last_compile_duration', { seconds })}
      overlayProps={{ placement: 'bottom' }}
    >
      <span
        className="toolbar-pdf-compile-time"
        aria-label={t('last_compile_duration', { seconds })}
      >
        {compiling ? (
          <MaterialIcon type="hourglass_top" />
        ) : (
          <MaterialIcon type="timer" />
        )}
        <span>{seconds} s</span>
      </span>
    </OLTooltip>
  )
}

export default memo(PdfCompileTime)
