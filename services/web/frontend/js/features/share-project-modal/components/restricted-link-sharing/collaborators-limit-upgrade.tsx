import { Button } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import Notification from '@/shared/components/notification'
import { upgradePlan } from '@/main/account-upgrade'
import { useProjectContext } from '@/shared/context/project-context'
import { useUserContext } from '@/shared/context/user-context'
import StartFreeTrialButton from '@/shared/components/start-free-trial-button'

export default function CollaboratorsLimitUpgrade() {
  const { t } = useTranslation()
  const { features } = useProjectContext()
  const user = useUserContext()

  return (
    <div className="invite-warning">
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
              buttonProps={{ variant: 'secondary', size: 'small' }}
              source="project-sharing"
              variant="limit"
            >
              {t('upgrade')}
            </StartFreeTrialButton>
          ) : (
            <Button
              bsSize="sm"
              className="btn-secondary"
              onClick={() => {
                upgradePlan('project-sharing')
              }}
            >
              {t('upgrade')}
            </Button>
          )
        }
      />
    </div>
  )
}
