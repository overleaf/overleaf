import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from 'react-bootstrap'
import { useUserContext } from '../../../shared/context/user-context'
import { upgradePlan } from '../../../main/account-upgrade'
import StartFreeTrialButton from '../../../shared/components/start-free-trial-button'
import Icon from '../../../shared/components/icon'
import { useFeatureFlag } from '../../../shared/context/split-test-context'

export default function AddCollaboratorsUpgrade() {
  const { t } = useTranslation()
  const user = useUserContext()

  const [startedFreeTrial, setStartedFreeTrial] = useState(false)
  const hasNewPaywallCta = useFeatureFlag('paywall-cta')

  return (
    <div className="add-collaborators-upgrade">
      <p className="text-center">
        {t('need_to_upgrade_for_more_collabs')}. {t('also')}:
      </p>
      <ul className="list-unstyled">
        <li>
          <Icon type="check" />
          &nbsp;
          {t('unlimited_projects')}
        </li>
        <li>
          <Icon type="check" />
          &nbsp;
          {t('collabs_per_proj', {
            collabcount: 'Multiple',
          })}
        </li>
        <li>
          <Icon type="check" />
          &nbsp;
          {t('full_doc_history')}
        </li>
        <li>
          <Icon type="check" />
          &nbsp;
          {t('sync_to_dropbox')}
        </li>
        <li>
          <Icon type="check" />
          &nbsp;
          {t('sync_to_github')}
        </li>
        <li>
          <Icon type="check" />
          &nbsp;
          {t('compile_larger_projects')}
        </li>
      </ul>
      <p className="text-center row-spaced-thin">
        {user.allowedFreeTrial ? (
          <StartFreeTrialButton
            buttonProps={{ variant: 'primary' }}
            handleClick={() => setStartedFreeTrial(true)}
            source="project-sharing"
          >
            {hasNewPaywallCta
              ? t('add_more_collaborators')
              : t('start_free_trial')}
          </StartFreeTrialButton>
        ) : (
          <Button
            bsStyle="primary"
            onClick={() => {
              upgradePlan('project-sharing')
              setStartedFreeTrial(true)
            }}
          >
            {t('upgrade')}
          </Button>
        )}
      </p>
      {startedFreeTrial && (
        <p className="small">{t('refresh_page_after_starting_free_trial')}</p>
      )}
    </div>
  )
}
