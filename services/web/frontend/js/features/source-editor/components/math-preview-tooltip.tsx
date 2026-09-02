import { useProjectSettingsContext } from '@/features/ide-settings/context/project-settings-context'
import {
  OLDropdown,
  OLDropdownMenu,
  OLDropdownToggle,
} from '@/shared/components/ol/ol-dropdown-menu'
import OLButton from '@/shared/components/ol/ol-button'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import MaterialIcon from '@/shared/components/material-icon'
import useEventListener from '@/shared/hooks/use-event-listener'
import { FC, useCallback, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import {
  useCodeMirrorStateContext,
  useCodeMirrorViewContext,
} from './codemirror-context'
import { mathPreviewStateField } from '../extensions/math-preview'
import { getTooltip } from '@codemirror/view'
import ReactDOM from 'react-dom'
import DropdownMenuItem from '@/shared/components/dropdown/dropdown-menu-item'
import { useFeatureFlag } from '@/shared/context/split-test-context'

const MathPreviewTooltipContainer: FC = () => {
  const state = useCodeMirrorStateContext()
  const view = useCodeMirrorViewContext()

  const mathPreviewState = state.field(mathPreviewStateField, false)

  if (!mathPreviewState) {
    return null
  }

  const { tooltip } = mathPreviewState

  if (!tooltip) {
    return null
  }

  const tooltipView = getTooltip(view, tooltip)

  if (!tooltipView) {
    return null
  }

  const inner = tooltipView.dom.querySelector('#ol-cm-math-tooltip')

  if (!inner) {
    return null
  }

  return ReactDOM.createPortal(<MathPreviewTooltipMenu />, inner)
}

const MathPreviewTooltipMenu: FC = () => {
  const { t } = useTranslation()

  const themed = useFeatureFlag('themed-modals')

  const [showDisableModal, setShowDisableModal] = useState(false)
  const { setMathPreview } = useProjectSettingsContext()
  const openDisableModal = useCallback(() => setShowDisableModal(true), [])
  const closeDisableModal = useCallback(() => setShowDisableModal(false), [])

  const onHide = useCallback(() => {
    window.dispatchEvent(new Event('editor:hideMathTooltip'))
  }, [])

  const keyDownListener = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onHide()
      }
    },
    [onHide]
  )

  useEventListener('keydown', keyDownListener)

  return (
    <>
      <OLDropdown align="end">
        <OLDropdownToggle
          id="some-id"
          className="math-tooltip-options-toggle"
          variant="secondary"
          size="sm"
        >
          <MaterialIcon
            type="more_vert"
            accessibilityLabel={t('more_options')}
          />
        </OLDropdownToggle>
        <OLDropdownMenu flip={false}>
          <DropdownMenuItem
            onClick={onHide}
            description={t('temporarily_hides_the_preview')}
            trailingIcon={
              <span className="math-tooltip-options-keyboard-shortcut">
                Esc
              </span>
            }
          >
            {t('hide')}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={openDisableModal}
            description={t('permanently_disables_the_preview')}
          >
            {t('disable')}
          </DropdownMenuItem>
        </OLDropdownMenu>
      </OLDropdown>

      {showDisableModal && (
        <OLModal show onHide={closeDisableModal} themed={themed}>
          <OLModalHeader>
            <OLModalTitle>{t('disable_equation_preview')}</OLModalTitle>
          </OLModalHeader>

          <OLModalBody>
            {t('disable_equation_preview_confirm')}
            <br />
            <Trans
              i18nKey="disable_equation_preview_enable_in_settings"
              components={{ b: <strong /> }}
            />
          </OLModalBody>

          <OLModalFooter>
            <OLButton variant="secondary" onClick={closeDisableModal}>
              {t('cancel')}
            </OLButton>
            <OLButton variant="danger" onClick={() => setMathPreview(false)}>
              {t('disable')}
            </OLButton>
          </OLModalFooter>
        </OLModal>
      )}
    </>
  )
}

export default MathPreviewTooltipContainer
