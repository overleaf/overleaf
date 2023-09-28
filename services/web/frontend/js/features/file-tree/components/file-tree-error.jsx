import { Button } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import { useLocation } from '../../../shared/hooks/use-location'

function FileTreeError() {
  const { t } = useTranslation()
  const { reload: handleClick } = useLocation()

  return (
    <div className="file-tree-error">
      <p>{t('generic_something_went_wrong')}</p>
      <p>{t('please_refresh')}</p>
      <Button bsStyle="primary" onClick={handleClick}>
        {t('refresh')}
      </Button>
    </div>
  )
}

export default FileTreeError
