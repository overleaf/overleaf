import { useIdeRedesignSwitcherContext } from '@/features/ide-react/context/ide-redesign-switcher-context'
import OLButton from '@/shared/components/ol/ol-button'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import MaterialIcon from '@/shared/components/material-icon'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { GiveFeedbackLink } from './give-feedback-link'

export const LabsActions = () => {
  const { t } = useTranslation()
  const { setShowSwitcherModal } = useIdeRedesignSwitcherContext()
  const openEditorRedesignSwitcherModal = useCallback(() => {
    setShowSwitcherModal(true)
  }, [setShowSwitcherModal])

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
      <GiveFeedbackLink />
    </>
  )
}
