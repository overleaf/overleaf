import { useTranslation } from 'react-i18next'
import { Button } from 'react-bootstrap'
import Notification from '@/shared/components/notification'
import { upgradePlan } from '../../../../main/account-upgrade'
import { linkSharingEnforcementDate } from '../../utils/link-sharing'
import { useProjectContext } from '@/shared/context/project-context'

export default function AddCollaboratorsUpgrade() {
  const { t } = useTranslation()
  const { features } = useProjectContext()

  return (
    <div className="add-collaborators-upgrade">
      <Notification
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
            <Button
              bsSize="sm"
              className="btn-secondary"
              onClick={() => upgradePlan('project-sharing')}
            >
              {t('upgrade')}
            </Button>
            <a
              href="https://www.overleaf.com/blog/changes-to-project-sharing"
              target="_blank"
              rel="noreferrer"
            >
              {t('read_more')}
            </a>
          </div>
        }
      />
    </div>
  )
}
