import { useIdeRedesignSwitcherContext } from '@/features/ide-react/context/ide-redesign-switcher-context'
import OLButton from '@/shared/components/ol/ol-button'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import { FC, useCallback, useEffect } from 'react'
import {
  canUseNewEditor,
  useIsNewEditorEnabled,
  useIsNewEditorEnabledAsExistingUser,
} from '../../utils/new-editor-utils'
import Notification from '@/shared/components/notification'
import { useSwitchEnableNewEditorState } from '../../hooks/use-switch-enable-new-editor-state'
import { useTranslation } from 'react-i18next'
import { useEditorAnalytics } from '@/shared/hooks/use-editor-analytics'
import { useSurveyUrl } from '../../hooks/use-survey-url'
import useTutorial from '@/shared/hooks/promotions/use-tutorial'
import { useEditorContext } from '@/shared/context/editor-context'

const TUTORIAL_KEY = 'ide-redesign-beta-intro'

export const IdeRedesignIntroModal: FC = () => {
  const { t } = useTranslation()
  const { inactiveTutorials } = useEditorContext()
  const { showPopup, tryShowingPopup, dismissTutorial } = useTutorial(
    TUTORIAL_KEY,
    {
      name: TUTORIAL_KEY,
    }
  )
  const hasAccess = useIsNewEditorEnabledAsExistingUser()

  useEffect(() => {
    if (!hasAccess) return
    if (!inactiveTutorials.includes(TUTORIAL_KEY)) {
      tryShowingPopup()
    }
  }, [tryShowingPopup, inactiveTutorials, hasAccess])

  if (!hasAccess) {
    return null
  }

  return (
    <OLModal
      show={showPopup}
      onHide={dismissTutorial}
      className="ide-redesign-switcher-modal"
    >
      <OLModalHeader>
        <OLModalTitle>
          {t('the_new_overleaf_editor_try_now_in_beta')}
        </OLModalTitle>
      </OLModalHeader>
      <OLModalBody>
        <p>
          {t(
            'weve_redesigned_our_editor_to_make_it_easier_to_use_and_future_ready'
          )}{' '}
          {t('you_can_switch_back_to_the_old_editor_at_any_time')}
        </p>
        <SwitcherWhatsDifferent />
      </OLModalBody>
      <OLModalFooter>
        <OLButton onClick={dismissTutorial} variant="secondary">
          {t('close')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}

export const IdeRedesignSwitcherModal = () => {
  const { t } = useTranslation()
  const { showSwitcherModal, setShowSwitcherModal } =
    useIdeRedesignSwitcherContext()
  const onHide = useCallback(
    () => setShowSwitcherModal(false),
    [setShowSwitcherModal]
  )
  const { loading, error, setEditorRedesignStatus } =
    useSwitchEnableNewEditorState()
  const enabled = useIsNewEditorEnabled()
  const hasAccess = canUseNewEditor()
  if (!hasAccess) {
    return null
  }

  const Content = enabled
    ? SwitcherModalContentEnabled
    : SwitcherModalContentDisabled

  return (
    <OLModal
      show={showSwitcherModal}
      onHide={onHide}
      className="ide-redesign-switcher-modal"
    >
      <OLModalHeader>
        <OLModalTitle>
          {enabled
            ? t('beta_program_the_new_overleaf_editor')
            : t('the_new_overleaf_editor_try_now_in_beta')}
        </OLModalTitle>
      </OLModalHeader>
      {error && <Notification type="error" content={error} isDismissible />}
      <Content
        setEditorRedesignStatus={setEditorRedesignStatus}
        hide={onHide}
        loading={loading}
      />
    </OLModal>
  )
}

type ModalContentProps = {
  setEditorRedesignStatus: (enabled: boolean) => Promise<void>
  hide: () => void
  loading: boolean
}

const SwitcherModalContentEnabled: FC<ModalContentProps> = ({
  setEditorRedesignStatus,
  hide,
  loading,
}) => {
  const { t } = useTranslation()
  const { sendEvent } = useEditorAnalytics()
  const disable = useCallback(() => {
    sendEvent('editor-redesign-toggle', {
      action: 'disable',
      location: 'modal',
    })
    setEditorRedesignStatus(false)
      .then(hide)
      .catch(() => {
        // do nothing, we're already showing the error
      })
  }, [setEditorRedesignStatus, hide, sendEvent])

  const surveyURL = useSurveyUrl()

  return (
    <>
      <OLModalBody>
        <p>
          {t(
            'weve_redesigned_our_editor_to_make_it_easier_to_use_and_future_ready'
          )}
        </p>
        <SwitcherWhatsDifferent />
      </OLModalBody>
      <OLModalFooter>
        <OLButton
          onClick={disable}
          variant="secondary"
          className="me-auto"
          disabled={loading}
        >
          {t('switch_to_old_editor')}
        </OLButton>
        <OLButton onClick={hide} variant="secondary">
          {t('cancel')}
        </OLButton>
        <OLButton
          href={surveyURL}
          target="_blank"
          rel="noopener noreferrer"
          variant="primary"
        >
          {t('give_feedback')}
        </OLButton>
      </OLModalFooter>
    </>
  )
}

const SwitcherModalContentDisabled: FC<ModalContentProps> = ({
  setEditorRedesignStatus,
  hide,
  loading,
}) => {
  const { t } = useTranslation()
  const { sendEvent } = useEditorAnalytics()
  const enable = useCallback(() => {
    sendEvent('editor-redesign-toggle', {
      action: 'enable',
      location: 'modal',
    })
    setEditorRedesignStatus(true)
      .then(hide)
      .catch(() => {
        // do nothing, we're already showing the error
      })
  }, [setEditorRedesignStatus, hide, sendEvent])
  return (
    <>
      <OLModalBody>
        <p>
          {t(
            'weve_redesigned_our_editor_to_make_it_easier_to_use_and_future_ready'
          )}
        </p>
        <SwitcherWhatsDifferent />
        <LeavingNote />
      </OLModalBody>
      <OLModalFooter>
        <OLButton onClick={hide} variant="secondary">
          {t('cancel')}
        </OLButton>
        <OLButton onClick={enable} variant="primary" disabled={loading}>
          {t('switch_to_new_editor')}
        </OLButton>
      </OLModalFooter>
    </>
  )
}

const SwitcherWhatsDifferent = () => {
  const { t } = useTranslation()

  return (
    <div className="ide-redesign-switcher-modal-whats-new">
      <h4>{t('whats_different')}</h4>
      <ul>
        <li>{t('new_look_and_feel')}</li>
        <li>
          {t('new_navigation_introducing_left_hand_side_rail_and_top_menus')}
        </li>
        <li>{t('new_look_and_placement_of_the_settings')}</li>
        <li>{t('improved_dark_mode')}</li>
        <li>{t('review_panel_and_error_logs_moved_to_the_left')}</li>
      </ul>
    </div>
  )
}

const LeavingNote = () => {
  const { t } = useTranslation()

  return <p>{t('you_can_switch_back_to_the_old_editor_at_any_time')}</p>
}
