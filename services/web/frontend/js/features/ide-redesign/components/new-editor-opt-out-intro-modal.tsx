import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import { useCallback, useEffect, useState } from 'react'
import useTutorial from '@/shared/hooks/promotions/use-tutorial'
import OLButton from '@/shared/components/ol/ol-button'
import { useTranslation } from 'react-i18next'
import { useEditorContext } from '@/shared/context/editor-context'
import { useIsNewToNewEditor } from '../utils/new-editor-utils'
import { useNewEditorTourContext } from '../contexts/new-editor-tour-context'
import promoVideo from './new-editor-promo-video.mp4'

const TUTORIAL_KEY = 'new-editor-intro-2'

export default function NewEditorOptOutIntroModal() {
  const { inactiveTutorials } = useEditorContext()
  const {
    tryShowingPopup,
    showPopup: showModal,
    dismissTutorial,
    completeTutorial,
    clearPopup,
  } = useTutorial(TUTORIAL_KEY, {
    name: TUTORIAL_KEY,
  })
  const { startTour } = useNewEditorTourContext()

  const { t } = useTranslation()

  const [hasShown, setHasShown] = useState(false)
  const isNewToNewEditor = useIsNewToNewEditor()

  useEffect(() => {
    if (
      isNewToNewEditor &&
      !hasShown &&
      !inactiveTutorials.includes(TUTORIAL_KEY)
    ) {
      tryShowingPopup('notification-prompt')
      setHasShown(true)
    }
  }, [tryShowingPopup, inactiveTutorials, isNewToNewEditor, hasShown])

  const startProductTour = useCallback(() => {
    completeTutorial({ event: 'notification-click', action: 'complete' })
    startTour()
    clearPopup()
  }, [completeTutorial, startTour, clearPopup])

  const closeModal = useCallback(() => {
    dismissTutorial('notification-dismiss')
    clearPopup()
  }, [dismissTutorial, clearPopup])

  return (
    <OLModal show={showModal} onHide={closeModal}>
      <OLModalHeader>
        <OLModalTitle>{t('introducing_overleafs_new_look')}</OLModalTitle>
      </OLModalHeader>
      <OLModalBody className="new-editor-intro-modal-body">
        <div>{t('the_new_and_improved_overleaf_editor_design')}</div>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video autoPlay loop muted>
          <source src={promoVideo} type="video/mp4" />
        </video>
        <div>
          {t('weve_made_it_easier_to_find_and_use_the_tools_you_need_today')}
        </div>
      </OLModalBody>
      <OLModalFooter>
        <OLButton onClick={startProductTour} variant="primary">
          {t('explore_what_s_new')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}
