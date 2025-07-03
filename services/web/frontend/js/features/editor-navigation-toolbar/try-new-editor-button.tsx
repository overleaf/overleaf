import { useCallback, useRef } from 'react'
import OLButton from '../ui/components/ol/ol-button'
import { useIdeRedesignSwitcherContext } from '../ide-react/context/ide-redesign-switcher-context'
import MaterialIcon from '@/shared/components/material-icon'
import { useTranslation } from 'react-i18next'
import TooltipPromotion from '../ide-redesign/components/tooltip-promo'

const TUTORIAL_KEY = 'try-redesign-again-nudge-promo'
const EVENT_DATA = { name: 'try-redesign-again-nudge-promotion' }

const TryNewEditorButton = () => {
  const { t } = useTranslation()
  const { setShowSwitcherModal } = useIdeRedesignSwitcherContext()

  const switcherButtonRef = useRef(null)

  const onClick = useCallback(() => {
    setShowSwitcherModal(true)
  }, [setShowSwitcherModal])
  return (
    <div className="d-flex align-items-center">
      <OLButton
        className="toolbar-experiment-button"
        onClick={onClick}
        size="sm"
        leadingIcon={<MaterialIcon type="experiment" unfilled />}
        variant="secondary"
        ref={switcherButtonRef}
      >
        {t('try_the_new_editor')}
      </OLButton>
      <TooltipPromotion
        target={switcherButtonRef.current}
        splitTestName="ide-redesign-experiment-nudge"
        tutorialKey={TUTORIAL_KEY}
        eventData={EVENT_DATA}
        className="toolbar-experiment-tooltip"
        header={t('dont_miss_out_on_the_updated_editor')}
        content={t(
          'weve_been_making_changes_and_improvements_why_not_give_it_a_try'
        )}
      />
    </div>
  )
}

export default TryNewEditorButton
