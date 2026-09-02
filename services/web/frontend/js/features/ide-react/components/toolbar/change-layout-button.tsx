import { useTranslation } from 'react-i18next'
import classNames from 'classnames'
import {
  OLDropdown,
  OLDropdownMenu,
  OLDropdownToggle,
} from '@/shared/components/ol/ol-dropdown-menu'
import ChangeLayoutOptions from './change-layout-options'
import MaterialIcon from '@/shared/components/material-icon'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import { useCommandProvider } from '../../hooks/use-command-provider'
import { useFeatureFlag } from '@/shared/context/split-test-context'
import { useEditorAnalytics } from '@/shared/hooks/use-editor-analytics'
import { useLayoutContext } from '@/shared/context/layout-context'

export default function ChangeLayoutButton() {
  const { t } = useTranslation()
  const toggleButtonClassName = classNames(
    'ide-redesign-toolbar-button-subdued',
    'ide-redesign-toolbar-dropdown-toggle-subdued',
    'ide-redesign-toolbar-button-icon'
  )

  const {
    detachIsLinked,
    detachRole,
    handleChangeLayout,
    handleDetach,
    focusMode,
    setFocusMode,
  } = useLayoutContext()

  const { sendEvent } = useEditorAnalytics()
  const focusModeEnabled = useFeatureFlag('focus-mode')

  const detachable = 'BroadcastChannel' in window

  const waitingForDetachedLink = !detachIsLinked && detachRole === 'detacher'

  useCommandProvider(
    () => [
      {
        id: 'change-layout-side-by-side',
        handler: () => handleChangeLayout('sideBySide'),
        label: t('split_view'),
      },
      {
        id: 'change-layout-editor-only',
        handler: () => handleChangeLayout('flat', 'editor'),
        label: t('editor_only'),
      },
      {
        id: 'change-layout-pdf-only',
        handler: () => handleChangeLayout('flat', 'pdf'),
        label: t('pdf_only'),
      },
      {
        id: 'change-layout-detached-pdf',
        handler: () => handleDetach(),
        disabled: !detachable || waitingForDetachedLink,
        label: t('pdf_in_different_tab'),
      },
      ...(focusModeEnabled
        ? [
            {
              id: 'change-layout-focus-mode',
              handler: () => {
                setFocusMode(!focusMode)
                sendEvent('focus-mode-toggle', { focusMode: !focusMode })
              },
              label: t('toggle_focus_mode'),
            },
          ]
        : []),
    ],
    [
      handleChangeLayout,
      t,
      detachable,
      handleDetach,
      waitingForDetachedLink,
      focusModeEnabled,
      focusMode,
      setFocusMode,
      sendEvent,
    ]
  )

  return (
    <div className="ide-redesign-toolbar-button-container">
      <OLDropdown className="toolbar-item layout-dropdown" align="end">
        <OLTooltip
          id="tooltip-open-layout-options"
          description={t('layout_options')}
          overlayProps={{ delay: 0, placement: 'bottom' }}
        >
          <span>
            <OLDropdownToggle
              id="layout-dropdown-btn"
              className={toggleButtonClassName}
              aria-label={t('layout_options')}
            >
              <MaterialIcon type="space_dashboard" unfilled />
            </OLDropdownToggle>
          </span>
        </OLTooltip>
        <OLDropdownMenu>
          <ChangeLayoutOptions />
        </OLDropdownMenu>
      </OLDropdown>
    </div>
  )
}
