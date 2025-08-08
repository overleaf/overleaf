import { useTranslation } from 'react-i18next'
import Notification from '@/shared/components/notification'
import { upgradePlan } from '@/main/account-upgrade'
import { linkSharingEnforcementDate } from '../utils/link-sharing'
import { useProjectContext } from '@/shared/context/project-context'
import { useUserContext } from '@/shared/context/user-context'
import { sendMB } from '@/infrastructure/event-tracking'
import StartFreeTrialButton from '@/shared/components/start-free-trial-button'
import OLButton from '@/shared/components/ol/ol-button'

export default function AddCollaboratorsUpgrade() {
  const { t } = useTranslation()
  const { features } = useProjectContext()
  const user = useUserContext()

  return (
    <div className="add-collaborators-upgrade">
      <Notification
        isActionBelowContent
        type="warning"
        title={t('editor_limit_exceeded_in_this_project')}
        content={
          <p>
            {t('your_plan_is_limited_to_n_editors', {
              count: features.collaborators,
            })}{' '}
            {t('from_enforcement_date', {
              enforcementDate: linkSharingEnforcementDate,
            })}
          </p>
        }
        action={
          <div className="upgrade-actions">
            {user.allowedFreeTrial ? (
              <StartFreeTrialButton
                buttonProps={{ variant: 'secondary', size: 'sm' }}
                source="project-sharing"
                variant="exceeds"
              >
                {t('upgrade')}
              </StartFreeTrialButton>
            ) : (
              <OLButton
                variant="secondary"
                size="sm"
                onClick={() => {
                  upgradePlan('project-sharing')
                }}
              >
                {t('upgrade')}
              </OLButton>
            )}
            <OLButton
              variant="link"
              size="sm"
              href="https://www.overleaf.com/blog/changes-to-project-sharing"
              target="_blank"
              rel="noreferrer"
              onClick={() => {
                sendMB('paywall-info-click', {
                  'paywall-type': 'project-sharing',
                  content: 'blog',
                  variant: 'exceeds',
                })
              }}
            >
              {t('read_more')}
            </OLButton>
          </div>
        }
      />
    </div>
  )
}
