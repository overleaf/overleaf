import { useTranslation } from 'react-i18next'
import { useReviewPanelUpdaterFnsContext } from '../../context/review-panel/review-panel-context'
import Icon from '@/shared/components/icon'
import MaterialIcon from '@/shared/components/material-icon'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

function Toggler() {
  const { t } = useTranslation()
  const { toggleReviewPanel } = useReviewPanelUpdaterFnsContext()

  const handleTogglerClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    const target = event.target as HTMLButtonElement
    target.blur()
    toggleReviewPanel()
  }

  return (
    <button
      type="button"
      className="review-panel-toggler"
      onClick={handleTogglerClick}
    >
      <span className="sr-only">{t('hotkey_toggle_review_panel')}</span>
      <span className="review-panel-toggler-icon">
        <BootstrapVersionSwitcher
          bs3={<Icon type="chevron-left" />}
          bs5={<MaterialIcon type="chevron_left" />}
        />
      </span>
    </button>
  )
}

export default Toggler
