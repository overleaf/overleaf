import { useIdeRedesignSwitcherContext } from '@/features/ide-react/context/ide-redesign-switcher-context'
import OLButton from '@/features/ui/components/ol/ol-button'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import MaterialIcon from '@/shared/components/material-icon'
import { useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useSurveyUrl } from '../../hooks/use-survey-url'
import TooltipPromotion from '../tooltip-promo'

const TUTORIAL_KEY = 'ide-redesign-new-survey-promo'
const EVENT_DATA = { name: 'ide-redesign-new-survey-promotion' }

export const LabsActions = () => {
  const { t } = useTranslation()
  const { setShowSwitcherModal } = useIdeRedesignSwitcherContext()
  const openEditorRedesignSwitcherModal = useCallback(() => {
    setShowSwitcherModal(true)
  }, [setShowSwitcherModal])
  const surveyURL = useSurveyUrl()
  const feedbackLinkRef = useRef<HTMLAnchorElement>(null)

  return (
    <>
      <div className="ide-redesign-toolbar-button-container">
        <OLTooltip
          id="tooltip-labs-button"
          description={t(
            'this_is_a_labs_experiment_for_the_new_overleaf_editor_some_features_are_still_in_progress'
          )}
          overlayProps={{ delay: 0, placement: 'bottom' }}
        >
          <OLButton
            size="sm"
            variant="secondary"
            className="ide-redesign-labs-button"
            onClick={openEditorRedesignSwitcherModal}
            leadingIcon={<MaterialIcon type="experiment" unfilled />}
          >
            {t('labs')}
          </OLButton>
        </OLTooltip>
      </div>
      <div className="ide-redesign-toolbar-button-container">
        <a
          ref={feedbackLinkRef}
          href={surveyURL}
          rel="noopener noreferrer"
          target="_blank"
          className="ide-redesign-toolbar-labs-feedback-link"
        >
          {t('give_feedback')}
        </a>
        <TooltipPromotion
          target={feedbackLinkRef.current}
          splitTestName="ide-redesign-new-survey-prompt"
          content={t('tell_us_what_you_think')}
          header={t('how_are_you_finding_the_updates_to_the_new_editor')}
          eventData={EVENT_DATA}
          tutorialKey={TUTORIAL_KEY}
          placement="bottom"
        />
      </div>
    </>
  )
}
