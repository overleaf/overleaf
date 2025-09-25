import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import OLSpinner, { OLSpinnerSize } from '@/shared/components/ol/ol-spinner'
import classNames from 'classnames'

function LoadingSpinner({
  align,
  delay = 0,
  loadingText,
  size = 'sm',
  className,
}: {
  align?: 'left' | 'center'
  delay?: 0 | 500 // 500 is our standard delay
  loadingText?: string
  size?: OLSpinnerSize
  className?: string
}) {
  const { t } = useTranslation()

  const [show, setShow] = useState(false)

  useEffect(() => {
    // Ensure that spinner is displayed immediately if delay is 0
    if (delay === 0) {
      setShow(true)
      return
    }

    const timer = window.setTimeout(() => {
      setShow(true)
    }, delay)

    return () => {
      window.clearTimeout(timer)
    }
  }, [delay])

  if (!show) {
    return null
  }

  return (
    <div
      role="status"
      className={classNames(
        'loading',
        className,
        align === 'left' ? 'align-items-start' : 'align-items-center'
      )}
    >
      <OLSpinner size={size} />
      {loadingText || `${t('loading')}…`}
    </div>
  )
}

export default LoadingSpinner

export function FullSizeLoadingSpinner({
  delay = 0,
  minHeight,
  loadingText,
  size = 'sm',
  className,
}: {
  delay?: 0 | 500
  minHeight?: string
  loadingText?: string
  size?: OLSpinnerSize
  className?: string
}) {
  return (
    <div
      className={classNames('full-size-loading-spinner-container', className)}
      style={{ minHeight }}
    >
      <LoadingSpinner size={size} loadingText={loadingText} delay={delay} />
    </div>
  )
}
