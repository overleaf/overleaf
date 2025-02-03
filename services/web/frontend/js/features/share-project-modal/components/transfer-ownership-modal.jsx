import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import PropTypes from 'prop-types'
import Icon from '@/shared/components/icon'
import { transferProjectOwnership } from '../utils/api'
import { useProjectContext } from '@/shared/context/project-context'
import { useLocation } from '@/shared/hooks/use-location'
import OLModal, {
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/features/ui/components/ol/ol-modal'
import OLNotification from '@/features/ui/components/ol/ol-notification'
import OLButton from '@/features/ui/components/ol/ol-button'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import { bsVersion } from '@/features/utils/bootstrap-5'
import { Spinner } from 'react-bootstrap-5'

export default function TransferOwnershipModal({ member, cancel }) {
  const { t } = useTranslation()

  const [inflight, setInflight] = useState(false)
  const [error, setError] = useState(false)
  const location = useLocation()

  const { _id: projectId, name: projectName } = useProjectContext()

  function confirm() {
    setError(false)
    setInflight(true)

    transferProjectOwnership(projectId, member)
      .then(() => {
        location.reload()
      })
      .catch(() => {
        setError(true)
        setInflight(false)
      })
  }

  return (
    <OLModal show onHide={cancel}>
      <OLModalHeader closeButton>
        <OLModalTitle>{t('change_project_owner')}</OLModalTitle>
      </OLModalHeader>
      <OLModalBody>
        <p>
          <Trans
            i18nKey="project_ownership_transfer_confirmation_1"
            values={{ user: member.email, project: projectName }}
            components={[<strong key="strong-1" />, <strong key="strong-2" />]}
            shouldUnescape
            tOptions={{ interpolation: { escapeValue: true } }}
          />
        </p>
        <p>{t('project_ownership_transfer_confirmation_2')}</p>
        {error && (
          <OLNotification
            type="error"
            content={t('generic_something_went_wrong')}
            className="mb-0 mt-3"
          />
        )}
      </OLModalBody>
      <OLModalFooter>
        <div className={bsVersion({ bs3: 'pull-left', bs5: 'me-auto' })}>
          {inflight && (
            <BootstrapVersionSwitcher
              bs3={<Icon type="refresh" spin />}
              bs5={
                <Spinner
                  animation="border"
                  aria-hidden="true"
                  size="sm"
                  role="status"
                />
              }
            />
          )}
        </div>
        <OLButton variant="secondary" onClick={cancel} disabled={inflight}>
          {t('cancel')}
        </OLButton>
        <OLButton variant="primary" onClick={confirm} disabled={inflight}>
          {t('change_owner')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}
TransferOwnershipModal.propTypes = {
  member: PropTypes.object.isRequired,
  cancel: PropTypes.func.isRequired,
}
