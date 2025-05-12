import { useTranslation } from 'react-i18next'
import MaterialIcon from '@/shared/components/material-icon'

function MenuButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation()

  return (
    <div className="toolbar-item">
      <button type="button" className="btn btn-full-height" onClick={onClick}>
        <MaterialIcon type="menu" className="editor-menu-icon align-middle" />
        <p className="toolbar-label">{t('menu')}</p>
      </button>
    </div>
  )
}

export default MenuButton
