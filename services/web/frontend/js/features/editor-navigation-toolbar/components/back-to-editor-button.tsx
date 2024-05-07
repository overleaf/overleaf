import { useTranslation } from 'react-i18next'
import { Button } from 'react-bootstrap'
import MaterialIcon from '@/shared/components/material-icon'

function BackToEditorButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation()

  return (
    <Button
      bsSize="sm"
      bsStyle={null}
      onClick={onClick}
      className="back-to-editor-btn"
    >
      <MaterialIcon type="arrow_back" className="toolbar-btn-secondary-icon" />
      <p className="toolbar-label">{t('back_to_editor')}</p>
    </Button>
  )
}

export default BackToEditorButton
