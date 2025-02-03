import { useTranslation } from 'react-i18next'
import Notification from '@/shared/components/notification'
import { upgradePlan } from '@/main/account-upgrade'
import { useUserContext } from '@/shared/context/user-context'
import StartFreeTrialButton from '@/shared/components/start-free-trial-button'
import OLButton from '@/features/ui/components/ol/ol-button'

export default function CollaboratorsLimitUpgrade() {
  const { t } = useTranslation()
  const user = useUserContext()

  return (
    <div className="invite-warning">
      <Notification
        type="info"
        customIcon={
          <img
            src="/img/share-modal/add-more-editors.svg"
            alt=""
            aria-hidden="true"
          />
        }
        title={t('add_more_editors')}
        content={
          <p>
            {t('upgrade_to_add_more_editors_and_access_collaboration_features')}
          </p>
        }
        isActionBelowContent
        action={
          user.allowedFreeTrial ? (
            <StartFreeTrialButton
              buttonProps={{ variant: 'premium' }}
              source="project-sharing"
              variant="limit"
            >
              {t('upgrade')}
            </StartFreeTrialButton>
          ) : (
            <OLButton
              variant="premium"
              onClick={() => {
                upgradePlan('project-sharing')
              }}
            >
              {t('upgrade')}
            </OLButton>
          )
        }
      />
    </div>
  )
}
