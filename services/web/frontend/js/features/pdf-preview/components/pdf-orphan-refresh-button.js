import { Button } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import { memo } from 'react'
import { buildUrlWithDetachRole } from '../../../shared/utils/url-helper'

const redirect = function () {
  window.location = buildUrlWithDetachRole(null)
}

function PdfOrphanRefreshButton() {
  const { t } = useTranslation()

  return (
    <Button
      onClick={redirect}
      className="btn-orphan"
      bsStyle="primary"
      bsSize="small"
    >
      {t('redirect_to_editor')}
    </Button>
  )
}

export default memo(PdfOrphanRefreshButton)
