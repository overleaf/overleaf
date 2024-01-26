import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from 'react-bootstrap'

import { useUserContext } from '../../../shared/context/user-context'

import { upgradePlan } from '../../../main/account-upgrade'
import StartFreeTrialButton from '../../../shared/components/start-free-trial-button'
import AddCollaboratorsUpgradeContentDefault from './add-collaborators-upgrade-content-default'
import AddCollaboratorsUpgradeContentVariant from './add-collaborators-upgrade-content-variant'
import { useSplitTestContext } from '../../../shared/context/split-test-context'

export default function AddCollaboratorsUpgrade() {
  const { t } = useTranslation()
  const user = useUserContext()

  const [startedFreeTrial, setStartedFreeTrial] = useState(false)
  const { splitTestVariants } = useSplitTestContext()

  const variant = splitTestVariants['project-share-modal-paywall']

  return (
    <div className={variant === 'default' ? 'add-collaborators-upgrade' : ''}>
      {!variant || variant === 'default' ? (
        <AddCollaboratorsUpgradeContentDefault />
      ) : (
        <AddCollaboratorsUpgradeContentVariant />
      )}

      <p className="text-center row-spaced-thin">
        {user.allowedFreeTrial ? (
          <StartFreeTrialButton
            buttonProps={{ bsStyle: 'success' }}
            handleClick={() => setStartedFreeTrial(true)}
            source="project-sharing"
          />
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
