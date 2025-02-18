import ShareProjectModal from '@/features/share-project-modal/components/share-project-modal'
import OLButton from '@/features/ui/components/ol/ol-button'
import MaterialIcon from '@/shared/components/material-icon'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as eventTracking from '@/infrastructure/event-tracking'

export default function ShareProjectButton() {
  const { t } = useTranslation()

  const [showShareModal, setShowShareModal] = useState(false)

  const handleOpenShareModal = useCallback(() => {
    eventTracking.sendMBOnce('ide-open-share-modal-once')
    setShowShareModal(true)
  }, [])

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
