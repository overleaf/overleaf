import { useTranslation } from 'react-i18next'
import { Button } from 'react-bootstrap'
import Notification from '@/shared/components/notification'
import { upgradePlan } from '../../../../main/account-upgrade'

export default function AddCollaboratorsUpgrade() {
  const { t } = useTranslation()

  return (
    <div className="add-collaborators-upgrade">
      <Notification
        type="warning"
        title={t('editor_limit_exceeded_in_this_project')}
        content={<p>{t('your_plan_is_limited_to_n_editors')}</p>}
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
