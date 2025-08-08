import { useTranslation } from 'react-i18next'
import Notification from '@/shared/components/notification'
import { upgradePlan } from '@/main/account-upgrade'
import { useProjectContext } from '@/shared/context/project-context'
import { useUserContext } from '@/shared/context/user-context'
import { sendMB } from '@/infrastructure/event-tracking'
import StartFreeTrialButton from '@/shared/components/start-free-trial-button'
import OLButton from '@/shared/components/ol/ol-button'

type AccessLevelsChangedProps = {
  somePendingEditorsResolved: boolean
}
export default function AccessLevelsChanged({
  somePendingEditorsResolved,
}: AccessLevelsChangedProps) {
  const { t } = useTranslation()
  const { features } = useProjectContext()
  const user = useUserContext()

  return (
    <div className="add-collaborators-upgrade">
      <Notification
        isActionBelowContent
        type={somePendingEditorsResolved ? 'info' : 'warning'}
        title={
          somePendingEditorsResolved
            ? t('select_access_levels')
            : t('access_levels_changed')
        }
        content={
          somePendingEditorsResolved ? (
            <p>{t('your_project_exceeded_collaborator_limit')}</p>
          ) : (
            <p>
              {t('this_project_exceeded_collaborator_limit')}{' '}
              {t('you_can_select_or_invite_collaborator', {
                count: features.collaborators,
              })}
            </p>
          )
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
