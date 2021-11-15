import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import Icon from '../../../shared/components/icon'

function ShareProjectButton({ onClick }) {
  const { t } = useTranslation()

  return (
    <div className="toolbar-item">
      <button className="btn btn-full-height" onClick={onClick}>
        <Icon type="fw" modifier="group" />
        <p className="toolbar-label">{t('share')}</p>
      </button>
    </div>
  )
}

ShareProjectButton.propTypes = {
  onClick: PropTypes.func.isRequired,
}

export default ShareProjectButton
