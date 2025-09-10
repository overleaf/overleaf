import ShareProjectModal from '@/features/share-project-modal/components/share-project-modal'
import OLButton from '@/shared/components/ol/ol-button'
import MaterialIcon from '@/shared/components/material-icon'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useEditorAnalytics } from '@/shared/hooks/use-editor-analytics'

export default function ShareProjectButton() {
  const { t } = useTranslation()
  const { sendEventOnce } = useEditorAnalytics()

  const [showShareModal, setShowShareModal] = useState(false)

  const handleOpenShareModal = useCallback(() => {
    sendEventOnce('ide-open-share-modal-once')
    setShowShareModal(true)
  }, [sendEventOnce])

  const handleHideShareModal = useCallback(() => {
    setShowShareModal(false)
  }, [])

  return (
    <>
      <div className="ide-redesign-toolbar-button-container">
        <OLButton
          size="sm"
          variant="primary"
          leadingIcon={<MaterialIcon type="person_add" />}
          onClick={handleOpenShareModal}
        >
          {t('share')}
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
