import { useTranslation } from 'react-i18next'
import Notification from '@/shared/components/notification'
import { upgradePlan } from '@/main/account-upgrade'
import { useProjectContext } from '@/shared/context/project-context'
import { useUserContext } from '@/shared/context/user-context'
import StartFreeTrialButton from '@/shared/components/start-free-trial-button'
import getMeta from '@/utils/meta'
import OLButton from '@/features/ui/components/ol/ol-button'

export default function CollaboratorsLimitUpgrade() {
  const { t } = useTranslation()
  const { features } = useProjectContext()
  const user = useUserContext()
  const linkSharingEnforcement = getMeta('ol-linkSharingEnforcement')

  return (
    <div className="invite-warning">
      {linkSharingEnforcement ? (
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
              {t(
                'upgrade_to_add_more_editors_and_access_collaboration_features'
              )}
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
      ) : (
        <Notification
          type="info"
          customIcon={<div />}
          title={t('upgrade_to_add_more_editors')}
          content={
            <p>
              {t('you_can_only_add_n_people_to_edit_a_project', {
                count: features.collaborators,
              })}
            </p>
          }
          action={
            user.allowedFreeTrial ? (
              <StartFreeTrialButton
                buttonProps={{ variant: 'secondary', size: 'sm' }}
                source="project-sharing"
                variant="limit"
              >
                {t('upgrade')}
              </StartFreeTrialButton>
            ) : (
              <OLButton
                size="sm"
                variant="secondary"
                onClick={() => {
                  upgradePlan('project-sharing')
                }}
              >
                {t('upgrade')}
              </OLButton>
            )
          }
        />
      )}
    </div>
  )
}
