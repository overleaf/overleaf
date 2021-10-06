import { useTranslation } from 'react-i18next'
import Icon from './icon'

function LoadingSpinner() {
  const { t } = useTranslation()
  return (
    <div className="loading">
      <Icon type="fw" modifier="refresh" spin />
      {`  ${t('loading')}…`}
    </div>
  )
}

export default LoadingSpinner
