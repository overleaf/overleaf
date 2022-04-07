import { useTranslation } from 'react-i18next'
import Icon from './icon'
import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'

function LoadingSpinner({ delay = 0 }) {
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
      {t('loading')}…
    </div>
  )
}

LoadingSpinner.propTypes = {
  delay: PropTypes.number,
}

export default LoadingSpinner
