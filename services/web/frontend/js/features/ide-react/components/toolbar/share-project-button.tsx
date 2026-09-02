import ShareProjectModal from '@/features/share-project-modal/components/share-project-modal'
import OLButton from '@/shared/components/ol/ol-button'
import OLBadge from '@/shared/components/ol/ol-badge'
import MaterialIcon from '@/shared/components/material-icon'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useEditorAnalytics } from '@/shared/hooks/use-editor-analytics'
import { useEditorContext } from '@/shared/context/editor-context'
import { useProjectContext } from '@/shared/context/project-context'
import useIsNetworkStalled from '@/features/ide-react/hooks/use-is-network-stalled'

export default function ShareProjectButton() {
  const { t } = useTranslation()
  const { sendEventOnce } = useEditorAnalytics()
  const { isProjectOwner } = useEditorContext()
  const { project } = useProjectContext()
  const isDisabledDueToNetworkStall = useIsNetworkStalled()

  const [showShareModal, setShowShareModal] = useState(false)

  const accessRequestCount = isProjectOwner
    ? (project?.editAccessRequests?.length ?? 0)
    : 0

  const handleOpenShareModal = useCallback(() => {
    sendEventOnce('ide-open-share-modal-once')
    setShowShareModal(true)
  }, [sendEventOnce])

  const handleHideShareModal = useCallback(() => {
    setShowShareModal(false)
  }, [])

  // Open the share modal automatically when the editor is loaded with
  // ?share=1 (used by the "Manage sharing" CTA in the access-request
  // email). Strip the flag so a reload doesn't reopen it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('share') !== '1') return
    setShowShareModal(true)
    params.delete('share')
    const search = params.toString()
    const newUrl =
      window.location.pathname +
      (search ? `?${search}` : '') +
      window.location.hash
    window.history.replaceState(null, '', newUrl)
  }, [])

  return (
    <>
      <div className="ide-redesign-toolbar-button-container">
        <OLButton
          size="sm"
          variant="primary"
          leadingIcon={<MaterialIcon type="person_add" />}
          onClick={handleOpenShareModal}
          disabled={isDisabledDueToNetworkStall}
        >
          {t('share')}
          {accessRequestCount > 0 && (
            <OLBadge pill bg="warning" className="lh-1">
              {accessRequestCount}
            </OLBadge>
          )}
        </OLButton>
      </div>
      <ShareProjectModal
        show={showShareModal}
        handleOpen={handleOpenShareModal}
        handleHide={handleHideShareModal}
      />
    </>
  )
}
