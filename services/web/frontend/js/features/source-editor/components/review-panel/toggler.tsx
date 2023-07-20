import { useTranslation } from 'react-i18next'
import { useReviewPanelUpdaterFnsContext } from '../../context/review-panel/review-panel-context'

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
    </button>
  )
}

export default Toggler
