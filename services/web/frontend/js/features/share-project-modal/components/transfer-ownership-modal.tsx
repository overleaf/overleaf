import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { transferProjectOwnership } from '../utils/api'
import { useProjectContext } from '@/shared/context/project-context'
import { useLocation } from '@/shared/hooks/use-location'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import OLNotification from '@/shared/components/ol/ol-notification'
import OLButton from '@/shared/components/ol/ol-button'
import { ProjectMember } from '@/shared/context/types/project-metadata'
import OLSpinner from '@/shared/components/ol/ol-spinner'

export default function TransferOwnershipModal({
  member,
  cancel,
}: {
  member: ProjectMember
  cancel: () => void
}) {
  const { t } = useTranslation()

  const [inflight, setInflight] = useState(false)
  const [error, setError] = useState(false)
  const location = useLocation()

  const { projectId, name: projectName } = useProjectContext()

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
      <OLModalHeader>
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
        <div className="me-auto">{inflight && <OLSpinner size="sm" />}</div>
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
