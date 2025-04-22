import { useIdeRedesignSwitcherContext } from '@/features/ide-react/context/ide-redesign-switcher-context'
import OLButton from '@/features/ui/components/ol/ol-button'
import OLModal, {
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/features/ui/components/ol/ol-modal'
import { FC, useCallback } from 'react'
import {
  canUseNewEditor,
  useIsNewEditorEnabled,
} from '../../utils/new-editor-utils'
import Notification from '@/shared/components/notification'
import { useSwitchEnableNewEditorState } from '../../hooks/use-switch-enable-new-editor-state'
import { Trans, useTranslation } from 'react-i18next'

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
      <OLModalHeader closeButton>
        <OLModalTitle>{t('the_new_overleaf_editor')}</OLModalTitle>
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
  const disable = useCallback(() => {
    setEditorRedesignStatus(false)
      .then(hide)
      .catch(() => {
        // do nothing, we're already showing the error
      })
  }, [setEditorRedesignStatus, hide])
  return (
    <>
      <OLModalBody>
        <h3>{t('youre_helping_us_shape_the_future_of_overleaf')}</h3>
        <p>
          {t(
            'thanks_for_being_part_of_this_labs_experiment_your_feedback_will_help_us_make_the_new_editor_the_best_yet'
          )}
        </p>
        <SwitcherWhatsNew />
        <LeavingNote />
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
          href="https://forms.gle/soyVStc5qDx9na1Z6"
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
  const enable = useCallback(() => {
    setEditorRedesignStatus(true)
      .then(hide)
      .catch(() => {
        // do nothing, we're already showing the error
      })
  }, [setEditorRedesignStatus, hide])
  return (
    <>
      <OLModalBody>
        <h3>{t('help_shape_the_future_of_overleaf')}</h3>
        <p>{t('were_redesigning_our_editor_to_make_it_easier_to_use')}</p>
        <SwitcherWhatsNew />
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

const SwitcherWhatsNew = () => {
  const { t } = useTranslation()
  return (
    <div className="ide-redesign-switcher-modal-whats-new">
      <h4>{t('whats_new')}</h4>
      <ul>
        <li>{t('new_look_and_feel')}</li>
        <li>
          {t('new_navigation_introducing_left_hand_side_rail_and_top_menus')}
        </li>
        <li>{t('new_look_and_placement_of_the_settings')}</li>
        <li>{t('improved_dark_mode')}</li>
        <li>{t('review_panel_and_error_logs_moved_to_the_left')}</li>
      </ul>
      <hr />
      <h4>{t('whats_next')}</h4>
      <ul>
        <li>{t('more_changes_based_on_your_feedback')}</li>
      </ul>
    </div>
  )
}

const LeavingNote = () => {
  return (
    <p className="ide-redesign-switcher-modal-leave-text">
      <Trans
        i18nKey="you_can_leave_the_experiment_from_your_account_settings_at_any_time"
        // eslint-disable-next-line react/jsx-key, jsx-a11y/anchor-has-content
        components={[<a href="/user/settings" />]}
        shouldUnescape
        tOptions={{ interpolation: { escapeValue: true } }}
      />
    </p>
  )
}
