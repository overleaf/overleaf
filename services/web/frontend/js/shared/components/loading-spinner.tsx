import { useTranslation } from 'react-i18next'
import Icon from './icon'
import { useEffect, useState } from 'react'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import { Spinner } from 'react-bootstrap-5'
import { setTimeout } from '@/utils/window'
import classNames from 'classnames'

function LoadingSpinner({
  align,
  delay = 0,
  loadingText,
  size,
}: {
  align?: 'left' | 'center'
  delay?: 0 | 500 // 500 is our standard delay
  loadingText?: string
  size?: 'sm'
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

  const alignmentClass =
    align === 'left' ? 'align-items-start' : 'align-items-center'

  return (
    <BootstrapVersionSwitcher
      bs3={
        <div className="loading">
          <Icon type="refresh" fw spin />
          &nbsp;
          {loadingText || t('loading')}…
        </div>
      }
      bs5={
        <div className={classNames(`d-flex ${alignmentClass}`)}>
          <Spinner
            animation="border"
            aria-hidden="true"
            role="status"
            className="align-self-center"
            size={size}
          />
          &nbsp;
          {loadingText || t('loading')}…
        </div>
      }
    />
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
