import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import MaterialIcon from '@/shared/components/material-icon'

function ShareProjectButton({ onClick }) {
  const { t } = useTranslation()

  return (
    <div className="toolbar-item">
      <button type="button" className="btn btn-full-height" onClick={onClick}>
        <MaterialIcon type="group_add" className="align-middle" />
        <p className="toolbar-label">{t('share')}</p>
      </button>
      <div id="toolbar-cio-share" className="toolbar-cio-tooltip" />
    </div>
  )
}

ShareProjectButton.propTypes = {
  onClick: PropTypes.func.isRequired,
}

export default ShareProjectButton
