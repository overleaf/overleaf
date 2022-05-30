import { memo, useCallback, useEffect, useMemo } from 'react'
import PropTypes from 'prop-types'
import { Dropdown, MenuItem } from 'react-bootstrap'
import { Trans, useTranslation } from 'react-i18next'
import Tooltip from '../../../shared/components/tooltip'
import Icon from '../../../shared/components/icon'
import IconChecked from '../../../shared/components/icon-checked'
import ControlledDropdown from '../../../shared/components/controlled-dropdown'
import IconEditorOnly from './icon-editor-only'
import IconPdfOnly from './icon-pdf-only'
import { useLayoutContext } from '../../../shared/context/layout-context'
import * as eventTracking from '../../../infrastructure/event-tracking'
import useEventListener from '../../../shared/hooks/use-event-listener'
import Shortcut from './shortcut'

function IconPlaceholder() {
  return <Icon type="" fw />
}

function IconRefresh() {
  return <Icon type="refresh" fw spin />
}

function IconLayout() {
  return <Icon type="columns" fw />
}

function IconDetach() {
  return <Icon type="window-restore" fw />
}

function IconCheckmark({ iconFor, pdfLayout, view, detachRole }) {
  if (detachRole === 'detacher' || view === 'history') {
    return <IconPlaceholder />
  }
  if (
    iconFor === 'editorOnly' &&
    pdfLayout === 'flat' &&
    (view === 'editor' || view === 'file')
  ) {
    return <IconChecked />
  } else if (iconFor === 'pdfOnly' && pdfLayout === 'flat' && view === 'pdf') {
    return <IconChecked />
  } else if (iconFor === 'sideBySide' && pdfLayout === 'sideBySide') {
    return <IconChecked />
  }
  // return empty icon for placeholder
  return <IconPlaceholder />
}

function LayoutMenuItem({ checkmark, icon, text, shortcut, ...props }) {
  return (
    <MenuItem {...props}>
      <div className="layout-menu-item">
        <div className="layout-menu-item-start">
          <div>{checkmark}</div>
          <div>{icon}</div>
          <div>{text}</div>
        </div>
        <Shortcut shortcut={shortcut} />
      </div>
    </MenuItem>
  )
}
LayoutMenuItem.propTypes = {
  checkmark: PropTypes.node.isRequired,
  icon: PropTypes.node.isRequired,
  text: PropTypes.oneOfType([PropTypes.string, PropTypes.node]).isRequired,
  shortcut: PropTypes.string.isRequired,
  onSelect: PropTypes.func,
}

function DetachDisabled() {
  const { t } = useTranslation()

  return (
    <Tooltip
      id="detach-disabled"
      description={t('your_browser_does_not_support_this_feature')}
      overlayProps={{ placement: 'left' }}
    >
      <LayoutMenuItem
        disabled
        checkmark={<IconPlaceholder />}
        icon={<IconDetach />}
        text={t('pdf_in_separate_tab')}
        shortcut="Control+Option+ArrowUp"
      />
    </Tooltip>
  )
}

function LayoutDropdownButton() {
  const { t } = useTranslation()

  const {
    reattach,
    detach,
    detachIsLinked,
    detachRole,
    changeLayout,
    view,
    pdfLayout,
  } = useLayoutContext(layoutContextPropTypes)

  const handleDetach = useCallback(() => {
    detach()
    eventTracking.sendMB('project-layout-detach')
  }, [detach])

  const handleReattach = useCallback(() => {
    if (detachRole !== 'detacher') {
      return
    }
    reattach()
    eventTracking.sendMB('project-layout-reattach')
  }, [detachRole, reattach])

  // reattach when the PDF pane opens
  useEventListener('ui:pdf-open', handleReattach)

  const handleChangeLayout = useCallback(
    (newLayout, newView) => {
      handleReattach()
      changeLayout(newLayout, newView)
      eventTracking.sendMB('project-layout-change', {
        layout: newLayout,
        view: newView,
      })
    },
    [changeLayout, handleReattach]
  )

  const keyMap = useMemo(() => {
    return {
      ArrowDown: () => handleChangeLayout('sideBySide', null),
      ArrowRight: () => handleChangeLayout('flat', 'pdf'),
      ArrowLeft: () => handleChangeLayout('flat', 'editor'),
      ArrowUp: () => handleDetach(),
    }
  }, [handleChangeLayout, handleDetach])

  useEffect(() => {
    const listener = event => {
      if (event.ctrlKey && event.altKey && event.key in keyMap) {
        event.preventDefault()
        event.stopImmediatePropagation()
        keyMap[event.key]()
      }
    }

    window.addEventListener('keydown', listener, true)

    return () => {
      window.removeEventListener('keydown', listener, true)
    }
  }, [keyMap])

  const processing = !detachIsLinked && detachRole === 'detacher'

  // bsStyle is required for Dropdown.Toggle, but we will override style
  return (
    <>
      {processing && (
        <div aria-live="assertive" className="sr-only">
          {t('layout_processing')}
        </div>
      )}
      <ControlledDropdown
        id="layout-dropdown"
        className="toolbar-item layout-dropdown"
        pullRight
      >
        <Dropdown.Toggle className="btn-full-height" bsStyle="link">
          {processing ? <IconRefresh /> : <IconLayout />}
          <span className="toolbar-label">{t('layout')}</span>
          <Tooltip
            id="pdf-detach-badge"
            description="New feature"
            overlayProps={{ placement: 'bottom', delayHide: 100 }}
          >
            <span className="info-badge" />
          </Tooltip>
        </Dropdown.Toggle>
        <Dropdown.Menu className="layout-dropdown-list">
          <LayoutMenuItem
            onSelect={() => handleChangeLayout('sideBySide')}
            checkmark={
              <IconCheckmark
                iconFor="sideBySide"
                pdfLayout={pdfLayout}
                view={view}
                detachRole={detachRole}
              />
            }
            icon={<Icon type="columns" fw />}
            text={t('editor_and_pdf')}
            shortcut="Control+Option+ArrowDown"
          />

          <LayoutMenuItem
            onSelect={() => handleChangeLayout('flat', 'editor')}
            checkmark={
              <IconCheckmark
                iconFor="editorOnly"
                pdfLayout={pdfLayout}
                view={view}
                detachRole={detachRole}
              />
            }
            icon={
              <i className="fa fa-fw">
                <IconEditorOnly />
              </i>
            }
            text={
              <Trans
                i18nKey="editor_only_hide_pdf"
                components={[
                  <span key="editor_only_hide_pdf" className="subdued" />,
                ]}
              />
            }
            shortcut="Control+Option+ArrowLeft"
          />

          <LayoutMenuItem
            onSelect={() => handleChangeLayout('flat', 'pdf')}
            checkmark={
              <IconCheckmark
                iconFor="pdfOnly"
                pdfLayout={pdfLayout}
                view={view}
                detachRole={detachRole}
              />
            }
            icon={
              <i className="fa fa-fw">
                <IconPdfOnly />
              </i>
            }
            text={
              <Trans
                i18nKey="pdf_only_hide_editor"
                components={[
                  <span key="pdf_only_hide_editor" className="subdued" />,
                ]}
              />
            }
            shortcut="Control+Option+ArrowRight"
          />

          {'BroadcastChannel' in window ? (
            <LayoutMenuItem
              onSelect={() => handleDetach()}
              checkmark={
                detachRole === 'detacher' ? (
                  detachIsLinked ? (
                    <IconChecked />
                  ) : (
                    <IconRefresh />
                  )
                ) : (
                  <IconPlaceholder />
                )
              }
              icon={<IconDetach />}
              text={t('pdf_in_separate_tab')}
              shortcut="Control+Option+ArrowUp"
            />
          ) : (
            <DetachDisabled />
          )}

          <MenuItem divider />
          <div className="pdf-detach-survey">
            <span>
              <span className="info-badge" />
            </span>
            <span className="pdf-detach-survey-text">
              The Layout menu and opening the PDF in a new tab are new features.{' '}
              <a
                href="https://docs.google.com/forms/d/e/1FAIpQLScBc0LSttM02-HgfoUi7jj7MmFT9u3Y4cUDwT_AmDK9to--gg/viewform"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('give_feedback')}.
              </a>
            </span>
          </div>
        </Dropdown.Menu>
      </ControlledDropdown>
    </>
  )
}

export default memo(LayoutDropdownButton)

IconCheckmark.propTypes = {
  iconFor: PropTypes.string.isRequired,
  pdfLayout: PropTypes.string.isRequired,
  view: PropTypes.string,
  detachRole: PropTypes.string,
}

const layoutContextPropTypes = {
  reattach: PropTypes.func.isRequired,
  detach: PropTypes.func.isRequired,
  changeLayout: PropTypes.func.isRequired,
  detachIsLinked: PropTypes.bool,
  detachRole: PropTypes.string,
  pdfLayout: PropTypes.string.isRequired,
  view: PropTypes.string,
}
