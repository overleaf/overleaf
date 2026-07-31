import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import OLButton from '@/shared/components/ol/ol-button'
import { useIdeReactContext } from '@/features/ide-react/context/ide-react-context'
import { useProjectContext } from '@/shared/context/project-context'
import { useUserContext } from '@/shared/context/user-context'
import getMeta from '@/utils/meta'
import useIsNetworkStalled from '@/features/ide-react/hooks/use-is-network-stalled'
import RequestAccessModal from './request-access-modal'

export default function RequestAccessButton() {
  const { t } = useTranslation()
  // Gate on the project owner's split-test bucket rather than the
  // viewer's: a viewer outside the experiment should still be able to
  // ask whenever the owner can see/action the request in the new share
  // modal. Computed server-side at editor load and surfaced as a meta
  // tag, so it never changes for the life of the editor session.
  const ownerHasSharingUpdates = getMeta('ol-ownerHasSharingUpdates')
  const { permissionsLevel } = useIdeReactContext()
  const { project } = useProjectContext()
  const { id: userId } = useUserContext()
  const isNetworkStalled = useIsNetworkStalled()
  const [showModal, setShowModal] = useState(false)
  const [locallyRequested, setLocallyRequested] = useState(false)

  const handleOpen = useCallback(() => setShowModal(true), [])
  const handleClose = useCallback(() => setShowModal(false), [])
  const handleSuccess = useCallback(() => {
    setLocallyRequested(true)
    setShowModal(false)
  }, [])

  if (!ownerHasSharingUpdates) return null
  if (permissionsLevel !== 'readOnly' && permissionsLevel !== 'review')
    return null
  if (!userId) return null
  // Hide the button while the network is stalled: permissionsLevel can read as
  // readOnly during an out-of-sync/offline lock even though the user really has
  // write access, so prompting them to "request access" would be misleading.
  // Temporary fix for issue #35882
  if (isNetworkStalled) return null

  // Once the owner grants *editor* access the requester becomes a named
  // collaborator with nothing left to request, so hide the button as soon as
  // they show up as an editor in the (live-refetched) members list — their
  // own permissionsLevel only updates on reload. Reviewers are intentionally
  // not hidden here: they can still request editor access.
  const isNowEditor = project?.members?.some(
    member => member._id === userId && member.privileges === 'readAndWrite'
  )
  if (isNowEditor) return null

  const hasRequested =
    locallyRequested || Boolean(project?.myAccessRequest?.privilegeLevel)

  return (
    <>
      <div className="ide-redesign-toolbar-button-container">
        <OLButton
          size="sm"
          variant="secondary"
          disabled={hasRequested}
          onClick={handleOpen}
        >
          {hasRequested ? t('edit_access_requested') : t('request_edit_access')}
        </OLButton>
      </div>
      <RequestAccessModal
        show={showModal}
        onSuccess={handleSuccess}
        onCancel={handleClose}
      />
    </>
  )
}
