import React from 'react'
import { Button } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'

function FileTreeError() {
  const { t } = useTranslation()

  function reload() {
    location.reload()
  }

  return (
    <div className="file-tree-error">
      <p>{t('generic_something_went_wrong')}</p>
      <p>{t('please_refresh')}</p>
      <Button bsStyle="primary" onClick={reload}>
        {t('refresh')}
      </Button>
    </div>
  )
}

export default FileTreeError
