import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import * as eventTracking from '../../../infrastructure/event-tracking'
import { useProjectContext } from '../../../shared/context/project-context'
import HotkeysModal from '../../hotkeys-modal/components/hotkeys-modal'
import LeftMenuButton from './left-menu-button'
import { isMac } from '@/shared/utils/os'

export default function HelpShowHotkeys() {
  const [showModal, setShowModal] = useState(false)
  const { t } = useTranslation()
  const { features } = useProjectContext()

  const showModalWithAnalytics = useCallback(() => {
    eventTracking.sendMB('left-menu-hotkeys')
    setShowModal(true)
  }, [])

  return (
    <>
      <LeftMenuButton onClick={showModalWithAnalytics} icon="keyboard">
        {t('show_hotkeys')}
      </LeftMenuButton>
      <HotkeysModal
        show={showModal}
        handleHide={() => setShowModal(false)}
        isMac={isMac}
        trackChangesVisible={features?.trackChangesVisible}
      />
    </>
  )
}
