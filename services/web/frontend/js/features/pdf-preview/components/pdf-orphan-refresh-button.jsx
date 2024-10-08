import { useTranslation } from 'react-i18next'
import { memo, useCallback } from 'react'
import { buildUrlWithDetachRole } from '@/shared/utils/url-helper'
import { useLocation } from '@/shared/hooks/use-location'
import OLButton from '@/features/ui/components/ol/ol-button'

function PdfOrphanRefreshButton() {
  const { t } = useTranslation()
  const location = useLocation()

  const redirect = useCallback(() => {
    location.assign(buildUrlWithDetachRole(null).toString())
  }, [location])

  return (
    <OLButton variant="primary" size="sm" onClick={redirect}>
      {t('redirect_to_editor')}
    </OLButton>
  )
}

export default memo(PdfOrphanRefreshButton)
