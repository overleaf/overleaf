import { useTranslation } from 'react-i18next'
import MaterialIcon from '@/shared/components/material-icon'
import OLButton from '@/features/ui/components/ol/ol-button'

function BackToEditorButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation()

  return (
    <OLButton
      variant="secondary"
      size="sm"
      onClick={onClick}
      className="back-to-editor-btn"
    >
      <MaterialIcon type="arrow_back" className="toolbar-btn-secondary-icon" />
      <span className="toolbar-label">{t('back_to_editor')}</span>
    </OLButton>
  )
}

export default BackToEditorButton
