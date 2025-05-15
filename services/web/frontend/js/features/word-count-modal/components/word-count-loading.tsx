import { Spinner } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'

export const WordCountLoading = () => {
  const { t } = useTranslation()

  return (
    <div className="loading">
      <Spinner animation="border" aria-hidden="true" size="sm" role="status" />
      &nbsp;
      {t('loading')}…
    </div>
  )
}
