import React from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import Icon from './icon'

function Processing({ isProcessing }) {
  const { t } = useTranslation()
  if (isProcessing) {
    return (
      <div aria-live="polite">
        {t('processing')}… <Icon type="fw" modifier="refresh" spin />
      </div>
    )
  } else {
    return <></>
  }
}

Processing.propTypes = {
  isProcessing: PropTypes.bool.isRequired,
}

export default Processing
