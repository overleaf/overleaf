import { useTranslation } from 'react-i18next'

function HistoryResyncChange() {
  const { t } = useTranslation()

  return <div>{t('history_resync')}</div>
}

export default HistoryResyncChange
