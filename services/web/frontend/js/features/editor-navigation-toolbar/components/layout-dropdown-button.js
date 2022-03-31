import { useCallback } from 'react'
import PropTypes from 'prop-types'
import { Dropdown, MenuItem, OverlayTrigger, Tooltip } from 'react-bootstrap'
import { Trans, useTranslation } from 'react-i18next'
import Icon from '../../../shared/components/icon'
import IconChecked from '../../../shared/components/icon-checked'
import ControlledDropdown from '../../../shared/components/controlled-dropdown'
import IconEditorOnly from './icon-editor-only'
import IconPdfOnly from './icon-pdf-only'
import { useLayoutContext } from '../../../shared/context/layout-context'
import * as eventTracking from '../../../infrastructure/event-tracking'

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
          <OverlayTrigger
            placement="bottom"
            overlay={<Tooltip id="pdf-detach-badge">Beta feature</Tooltip>}
            delayHide={100}
          >
            <span className="beta-badge" />
          </OverlayTrigger>
        </Dropdown.Toggle>
        <Dropdown.Menu id="layout-dropdown-list">
          <MenuItem onSelect={() => handleChangeLayout('sideBySide')}>
            <IconCheckmark
              iconFor="sideBySide"
              pdfLayout={pdfLayout}
              view={view}
              detachRole={detachRole}
            />
            <Icon type="columns" />
            {t('editor_and_pdf')}
          </MenuItem>

          <MenuItem
            onSelect={() => handleChangeLayout('flat', 'editor')}
            className="menu-item-with-svg"
          >
            <IconCheckmark
              iconFor="editorOnly"
              pdfLayout={pdfLayout}
              view={view}
              detachRole={detachRole}
            />
            <IconEditorOnly />
            <span>
              <Trans
                i18nKey="editor_only_hide_pdf"
                components={[
                  <span key="editor_only_hide_pdf" className="subdued" />,
                ]}
              />
            </span>
          </MenuItem>

          <MenuItem
            onSelect={() => handleChangeLayout('flat', 'pdf')}
            className="menu-item-with-svg"
          >
            <IconCheckmark
              iconFor="pdfOnly"
              pdfLayout={pdfLayout}
              view={view}
              detachRole={detachRole}
            />
            <IconPdfOnly />
            <span>
              <Trans
                i18nKey="pdf_only_hide_editor"
                components={[
                  <span key="pdf_only_hide_editor" className="subdued" />,
                ]}
              />
            </span>
          </MenuItem>

          {detachRole === 'detacher' ? (
            <MenuItem>
              {detachIsLinked ? <IconChecked /> : <IconRefresh />}
              <IconDetach />
              {t('pdf_in_separate_tab')}
            </MenuItem>
          ) : (
            <MenuItem onSelect={handleDetach}>
              <IconPlaceholder />
              <IconDetach />
              {t('pdf_in_separate_tab')}
            </MenuItem>
          )}

          <MenuItem divider />
          <div className="pdf-detach-survey">
            <span>
              <span className="beta-badge" />
            </span>
            <span className="pdf-detach-survey-text">
              The Layout menu and opening the PDF in a new tab are beta
              features.{' '}
              <a
                href="https://docs.google.com/forms/d/e/1FAIpQLScuxQA8Az9NQwvYgC6FALG7FEtCCj4e8of27e_L0SXGrJFRMw/viewform"
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

export default LayoutDropdownButton

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
