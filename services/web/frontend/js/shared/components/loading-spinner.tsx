import { useTranslation } from 'react-i18next'
import Icon from './icon'
import { useEffect, useState } from 'react'

function LoadingSpinner({
  delay = 0,
  loadingText,
}: {
  delay?: 0 | 500 // 500 is our standard delay
  loadingText?: string
}) {
  const { t } = useTranslation()

  const [show, setShow] = useState(false)

  useEffect(() => {
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
    <div className="loading">
      <Icon type="refresh" fw spin />
      &nbsp;
      {loadingText || t('loading')}…
    </div>
  )
}

export default LoadingSpinner

export function FullSizeLoadingSpinner({
  delay = 0,
  minHeight,
  loadingText,
}: {
  delay?: 0 | 500
  minHeight?: string
  loadingText?: string
}) {
  return (
    <div className="full-size-loading-spinner-container" style={{ minHeight }}>
      <LoadingSpinner loadingText={loadingText} delay={delay} />
    </div>
  )
}
