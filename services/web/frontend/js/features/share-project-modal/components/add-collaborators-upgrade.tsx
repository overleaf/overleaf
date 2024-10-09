import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUserContext } from '../../../shared/context/user-context'
import { upgradePlan } from '../../../main/account-upgrade'
import StartFreeTrialButton from '../../../shared/components/start-free-trial-button'
import Icon from '../../../shared/components/icon'
import { useFeatureFlag } from '../../../shared/context/split-test-context'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import MaterialIcon from '@/shared/components/material-icon'
import OLButton from '@/features/ui/components/ol/ol-button'

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
          <BootstrapVersionSwitcher
            bs3={<Icon type="check" />}
            bs5={<MaterialIcon type="check" className="align-text-bottom" />}
          />
          &nbsp;
          {t('unlimited_projects')}
        </li>
        <li>
          <BootstrapVersionSwitcher
            bs3={<Icon type="check" />}
            bs5={<MaterialIcon type="check" className="align-text-bottom" />}
          />
          &nbsp;
          {t('collabs_per_proj', {
            collabcount: 'Multiple',
          })}
        </li>
        <li>
          <BootstrapVersionSwitcher
            bs3={<Icon type="check" />}
            bs5={<MaterialIcon type="check" className="align-text-bottom" />}
          />
          &nbsp;
          {t('full_doc_history')}
        </li>
        <li>
          <BootstrapVersionSwitcher
            bs3={<Icon type="check" />}
            bs5={<MaterialIcon type="check" className="align-text-bottom" />}
          />
          &nbsp;
          {t('sync_to_dropbox')}
        </li>
        <li>
          <BootstrapVersionSwitcher
            bs3={<Icon type="check" />}
            bs5={<MaterialIcon type="check" className="align-text-bottom" />}
          />
          &nbsp;
          {t('sync_to_github')}
        </li>
        <li>
          <BootstrapVersionSwitcher
            bs3={<Icon type="check" />}
            bs5={<MaterialIcon type="check" className="align-text-bottom" />}
          />
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
          <OLButton
            variant="primary"
            onClick={() => {
              upgradePlan('project-sharing')
              setStartedFreeTrial(true)
            }}
          >
            {t('upgrade')}
          </OLButton>
        )}
      </p>
      {startedFreeTrial && (
        <p className="small">{t('refresh_page_after_starting_free_trial')}</p>
      )}
    </div>
  )
}
