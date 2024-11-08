import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import OLSpinner, {
  OLSpinnerSize,
} from '@/features/ui/components/ol/ol-spinner'
import { isBootstrap5 } from '@/features/utils/bootstrap-5'
import { setTimeout } from '@/utils/window'
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
    const timer = setTimeout(() => {
      setShow(true)
    }, delay)

    return () => {
      window.clearTimeout(timer)
    }
  }, [delay])

  if (!show) {
    return null
  }

  const extraClasses = isBootstrap5()
    ? [align === 'left' ? 'align-items-start' : 'align-items-center']
    : null

  return (
    <div className={classNames('loading', className, extraClasses)}>
      <OLSpinner size={size} />
      &nbsp;
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
