import { useTranslation } from 'react-i18next'

export default function NoSelectionPane() {
  const { t } = useTranslation()

  return (
    <div className="no-file-selection">
      <div className="no-file-selection-message">
        <h3>{t('no_selection_select_file')}</h3>
      </div>
    </div>
  )
}
