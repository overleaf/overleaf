import { useTranslation } from 'react-i18next'

export default function ErrorMessage() {
  const { t } = useTranslation()

  return (
    <div className="history-error">
      <div className="text-danger error">
        {t('generic_something_went_wrong')}
      </div>
    </div>
  )
}
