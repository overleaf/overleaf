import OLButton from '@/shared/components/ol/ol-button'
import MaterialIcon from '@/shared/components/material-icon'
import Notification from '@/shared/components/notification'
import { useEditorContext } from '@/shared/context/editor-context'
import useTutorial from '@/shared/hooks/promotions/use-tutorial'
import { useEffect } from 'react'
import { isNewEditorInBeta } from '../utils/new-editor-utils'
import { isInExperiment } from '@/utils/labs-utils'
import { useUserContext } from '@/shared/context/user-context'
import { useTranslation } from 'react-i18next'

const TUTORIAL_KEY = 'ide-redesign-labs-user-beta-promo'

export default function LabsUserBetaPromoWrapper() {
  const user = useUserContext()

  // Show beta promo to labs users who are not in beta
  // when the redesign switches to beta
  if (
    isNewEditorInBeta() &&
    isInExperiment('editor-redesign') &&
    !user.betaProgram
  ) {
    return <LabsUserBetaPromo />
  }
}

const LabsUserBetaPromo = () => {
  const { inactiveTutorials } = useEditorContext()
  const { showPopup, tryShowingPopup, dismissTutorial } = useTutorial(
    TUTORIAL_KEY,
    { name: TUTORIAL_KEY }
  )

  useEffect(() => {
    if (!inactiveTutorials.includes(TUTORIAL_KEY)) {
      tryShowingPopup()
    }
  }, [tryShowingPopup, inactiveTutorials])

  if (!showPopup) {
    return null
  }

  return (
    <Notification
      className="ide-redesign-labs-user-beta-promo"
      customIcon={<MaterialIcon type="experiment" unfilled />}
      type="success"
      isDismissible
      content={<NotificationContent />}
      onDismiss={dismissTutorial}
    />
  )
}

const NotificationContent = () => {
  const { t } = useTranslation()
  return (
    <>
      <div className="ide-redesign-labs-user-beta-promo-title">
        {t('thanks_for_trying_the_new_editor')}
      </div>
      <div>{t('the_labs_experiment_has_now_finished')}</div>
      <OLButton
        variant="secondary"
        className="ide-redesign-labs-user-beta-promo-button"
        href="/beta/participate"
        target="_blank"
        rel="noreferrer noopener"
      >
        {t('join_beta')}
      </OLButton>
    </>
  )
}
