import { useTranslation } from 'react-i18next'

export default function MultipleSelectionPane({
  selectedEntityCount,
}: {
  selectedEntityCount: number
}) {
  const { t } = useTranslation()

  return (
    <div className="multi-selection-ongoing">
      <div className="multi-selection-message">
        <h4>{`${selectedEntityCount} ${t('files_selected')}`}</h4>
      </div>
    </div>
  )
}
