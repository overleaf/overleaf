import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import { useSwitchEnableNewEditorState } from '../hooks/use-switch-enable-new-editor-state'
import { useCallback, useEffect, useState } from 'react'
import useTutorial from '@/shared/hooks/promotions/use-tutorial'
import OLButton from '@/shared/components/ol/ol-button'
import { Trans, useTranslation } from 'react-i18next'
import { useEditorContext } from '@/shared/context/editor-context'
import {
  canUseNewEditorAsExistingUser,
  useIsNewEditorEnabled,
} from '../utils/new-editor-utils'
import promoVideo from './new-editor-promo-video.mp4'

const TUTORIAL_KEY = 'new-editor-opt-in'

export default function NewEditorPromoModal() {
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
  const { setEditorRedesignStatus } = useSwitchEnableNewEditorState()
  const { t } = useTranslation()

  const newEditor = useIsNewEditorEnabled()
  const canShow = canUseNewEditorAsExistingUser() && !newEditor
  const [hasShown, setHasShown] = useState(false)

  useEffect(() => {
    if (canShow && !hasShown && !inactiveTutorials.includes(TUTORIAL_KEY)) {
      tryShowingPopup('notification-prompt')
      setHasShown(true)
    }
  }, [tryShowingPopup, inactiveTutorials, canShow, hasShown])

  const switchToNewEditor = useCallback(() => {
    setEditorRedesignStatus(true)
    completeTutorial({ event: 'notification-click', action: 'complete' })
    clearPopup()
  }, [setEditorRedesignStatus, completeTutorial, clearPopup])

  const closeModal = useCallback(() => {
    dismissTutorial('notification-dismiss')
    clearPopup()
  }, [dismissTutorial, clearPopup])

  if (!canShow) {
    return null
  }

  return (
    <OLModal show={showModal} onHide={closeModal}>
      <OLModalHeader>
        <OLModalTitle>{t('overleafs_new_look_is_here')}</OLModalTitle>
      </OLModalHeader>
      <OLModalBody className="new-editor-promo-modal-body">
        <div>
          {t(
            'be_one_of_the_first_to_try_out_the_new_and_improved_overleaf_editor'
          )}
        </div>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video autoPlay loop muted>
          <source src={promoVideo} type="video/mp4" />
        </video>
        <div>
          <Trans
            i18nKey="try_out_the_new_editor_now"
            components={[
              /* eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key */
              <a
                href="https://www.overleaf.com/blog/introducing-overleafs-new-look"
                target="_blank"
                rel="noopener noreferrer"
                key="link"
              />,
            ]}
          />
        </div>
      </OLModalBody>
      <OLModalFooter>
        <OLButton onClick={closeModal} variant="secondary">
          {t('not_now')}
        </OLButton>
        <OLButton onClick={switchToNewEditor} variant="primary">
          {t('try_the_new_look')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}
