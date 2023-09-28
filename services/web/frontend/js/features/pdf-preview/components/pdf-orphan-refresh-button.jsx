import { Button } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import { memo, useCallback } from 'react'
import { buildUrlWithDetachRole } from '../../../shared/utils/url-helper'
import { useLocation } from '../../../shared/hooks/use-location'

function PdfOrphanRefreshButton() {
  const { t } = useTranslation()
  const location = useLocation()

  const redirect = useCallback(() => {
    location.assign(buildUrlWithDetachRole(null).toString())
  }, [location])

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
