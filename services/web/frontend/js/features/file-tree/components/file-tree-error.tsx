import { useTranslation } from 'react-i18next'
import { useLocation } from '../../../shared/hooks/use-location'
import OLButton from '@/shared/components/ol/ol-button'

function FileTreeError() {
  const { t } = useTranslation()
  const { reload: handleClick } = useLocation()

  return (
    <div className="file-tree-error">
      <p>{t('generic_something_went_wrong')}</p>
      <p>{t('please_refresh')}</p>
      <OLButton variant="primary" onClick={handleClick}>
        {t('refresh')}
      </OLButton>
    </div>
  )
}

export default FileTreeError
