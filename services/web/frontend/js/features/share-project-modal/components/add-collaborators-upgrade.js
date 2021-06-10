import React, { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Button } from 'react-bootstrap'
import PropTypes from 'prop-types'

import { useApplicationContext } from '../../../shared/context/application-context'

import Icon from '../../../shared/components/icon'
import { upgradePlan } from '../../../main/account-upgrade'
import StartFreeTrialButton from '../../../shared/components/start-free-trial-button'

export default function AddCollaboratorsUpgrade() {
  const { t } = useTranslation()
  const { user } = useApplicationContext({
    user: PropTypes.shape({ allowedFreeTrial: PropTypes.boolean }),
  })

  const [startedFreeTrial, setStartedFreeTrial] = useState(false)

  return (
    <div className="add-collaborators-upgrade">
      <p className="text-center">
        <Trans i18nKey="need_to_upgrade_for_more_collabs" />. {t('also')}:
      </p>

      <ul className="list-unstyled">
        <li>
          <Icon type="check" />
          &nbsp;
          <Trans i18nKey="unlimited_projects" />
        </li>
        <li>
          <Icon type="check" />
          &nbsp;
          <Trans
            i18nKey="collabs_per_proj"
            values={{ collabcount: 'Multiple' }}
          />
        </li>
        <li>
          <Icon type="check" />
          &nbsp;
          <Trans i18nKey="full_doc_history" />
        </li>
        <li>
          <Icon type="check" />
          &nbsp;
          <Trans i18nKey="sync_to_dropbox" />
        </li>
        <li>
          <Icon type="check" />
          &nbsp;
          <Trans i18nKey="sync_to_github" />
        </li>
        <li>
          <Icon type="check" />
          &nbsp;
          <Trans i18nKey="compile_larger_projects" />
        </li>
      </ul>

      <p className="text-center row-spaced-thin">
        {user.allowedFreeTrial ? (
          <StartFreeTrialButton
            buttonStyle="success"
            setStartedFreeTrial={setStartedFreeTrial}
            source="project-sharing"
          />
        ) : (
          <Button
            bsStyle="success"
            onClick={() => {
              upgradePlan('project-sharing')
              setStartedFreeTrial(true)
            }}
          >
            <Trans i18nKey="upgrade" />
          </Button>
        )}
      </p>
      {startedFreeTrial && (
        <p className="small">
          <Trans i18nKey="refresh_page_after_starting_free_trial" />
        </p>
      )}
    </div>
  )
}
