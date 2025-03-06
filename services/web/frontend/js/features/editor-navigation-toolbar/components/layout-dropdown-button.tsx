import { memo, useCallback, forwardRef } from 'react'
import { Spinner } from 'react-bootstrap-5'
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
  DropdownToggleCustom,
} from '@/features/ui/components/bootstrap-5/dropdown-menu'
import { Trans, useTranslation } from 'react-i18next'
import {
  IdeLayout,
  IdeView,
  useLayoutContext,
} from '../../../shared/context/layout-context'
import * as eventTracking from '../../../infrastructure/event-tracking'
import useEventListener from '../../../shared/hooks/use-event-listener'
import { DetachRole } from '@/shared/context/detach-context'
import MaterialIcon from '@/shared/components/material-icon'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'

const isActiveDropdownItem = ({
  iconFor,
  pdfLayout,
  view,
  detachRole,
}: {
  iconFor: string
  pdfLayout: IdeLayout
  view: IdeView | null
  detachRole?: DetachRole
}) => {
  if (detachRole === 'detacher' || view === 'history') {
    return false
  }
  if (
    iconFor === 'editorOnly' &&
    pdfLayout === 'flat' &&
    (view === 'editor' || view === 'file')
  ) {
    return true
  } else if (iconFor === 'pdfOnly' && pdfLayout === 'flat' && view === 'pdf') {
    return true
  } else if (iconFor === 'sideBySide' && pdfLayout === 'sideBySide') {
    return true
  }
  return false
}

function EnhancedDropdownItem({
  active,
  ...props
}: React.ComponentProps<typeof DropdownItem>) {
  return (
    <DropdownItem
      active={active}
      aria-current={active}
      trailingIcon={active ? 'check' : null}
      {...props}
    />
  )
}

const LayoutDropdownToggleButton = forwardRef<
  HTMLButtonElement,
  {
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
  }
>(({ onClick, ...props }, ref) => {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    eventTracking.sendMB('navigation-clicked-layout')
    onClick(e)
  }

  return <DropdownToggleCustom {...props} ref={ref} onClick={handleClick} />
})
LayoutDropdownToggleButton.displayName = 'LayoutDropdownToggleButton'

function BS5DetachDisabled() {
  const { t } = useTranslation()

  return (
    <OLTooltip
      id="detach-disabled"
      description={t('your_browser_does_not_support_this_feature')}
      overlayProps={{ placement: 'left' }}
    >
      <span>
        <EnhancedDropdownItem disabled leadingIcon="select_window">
          {t('pdf_in_separate_tab')}
        </EnhancedDropdownItem>
      </span>
    </OLTooltip>
  )
}

function LayoutDropdownButton() {
  const {
    reattach,
    detach,
    detachIsLinked,
    detachRole,
    changeLayout,
    view,
    pdfLayout,
  } = useLayoutContext()

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
    (newLayout: IdeLayout, newView?: IdeView) => {
      handleReattach()
      changeLayout(newLayout, newView)
      eventTracking.sendMB('project-layout-change', {
        layout: newLayout,
        view: newView,
      })
    },
    [changeLayout, handleReattach]
  )

  return (
    <LayoutDropdownButtonUi
      processing={!detachIsLinked && detachRole === 'detacher'}
      handleChangeLayout={handleChangeLayout}
      handleDetach={handleDetach}
      detachIsLinked={detachIsLinked}
      detachRole={detachRole}
      pdfLayout={pdfLayout}
      view={view}
      detachable={'BroadcastChannel' in window}
    />
  )
}

type LayoutDropdownButtonUiProps = {
  processing: boolean
  handleChangeLayout: (newLayout: IdeLayout, newView?: IdeView) => void
  handleDetach: () => void
  detachIsLinked: boolean
  detachRole: DetachRole
  pdfLayout: IdeLayout
  view: IdeView | null
  detachable: boolean
}

export const LayoutDropdownButtonUi = ({
  processing,
  handleChangeLayout,
  handleDetach,
  detachIsLinked,
  detachRole,
  view,
  pdfLayout,
  detachable,
}: LayoutDropdownButtonUiProps) => {
  const { t } = useTranslation()
  return (
    <>
      {processing && (
        <div aria-live="assertive" className="sr-only">
          {t('layout_processing')}
        </div>
      )}
      <Dropdown className="toolbar-item layout-dropdown" align="end">
        <DropdownToggle
          id="layout-dropdown-btn"
          className="btn-full-height"
          as={LayoutDropdownToggleButton}
        >
          {processing ? (
            <Spinner
              animation="border"
              aria-hidden="true"
              size="sm"
              role="status"
            />
          ) : (
            <MaterialIcon type="dock_to_right" className="align-middle" />
          )}
          <span className="toolbar-label">{t('layout')}</span>
        </DropdownToggle>
        <DropdownMenu>
          <EnhancedDropdownItem
            onClick={() => handleChangeLayout('sideBySide')}
            active={isActiveDropdownItem({
              iconFor: 'sideBySide',
              pdfLayout,
              view,
              detachRole,
            })}
            leadingIcon="dock_to_right"
          >
            {t('editor_and_pdf')}
          </EnhancedDropdownItem>

          <EnhancedDropdownItem
            onClick={() => handleChangeLayout('flat', 'editor')}
            active={isActiveDropdownItem({
              iconFor: 'editorOnly',
              pdfLayout,
              view,
              detachRole,
            })}
            leadingIcon="code"
          >
            <div className="d-flex flex-column">
              <Trans
                i18nKey="editor_only_hide_pdf"
                components={[
                  <span key="editor_only_hide_pdf" className="subdued" />,
                ]}
              />
            </div>
          </EnhancedDropdownItem>

          <EnhancedDropdownItem
            onClick={() => handleChangeLayout('flat', 'pdf')}
            active={isActiveDropdownItem({
              iconFor: 'pdfOnly',
              pdfLayout,
              view,
              detachRole,
            })}
            leadingIcon="picture_as_pdf"
          >
            <div className="d-flex flex-column">
              <Trans
                i18nKey="pdf_only_hide_editor"
                components={[
                  <span key="pdf_only_hide_editor" className="subdued" />,
                ]}
              />
            </div>
          </EnhancedDropdownItem>

          {detachable ? (
            <EnhancedDropdownItem
              onClick={() => handleDetach()}
              active={detachRole === 'detacher' && detachIsLinked}
              trailingIcon={
                detachRole === 'detacher' ? (
                  detachIsLinked ? (
                    'check'
                  ) : (
                    <span className="spinner-container">
                      <Spinner
                        animation="border"
                        aria-hidden="true"
                        size="sm"
                        role="status"
                      />
                      <span className="visually-hidden">{t('loading')}</span>
                    </span>
                  )
                ) : null
              }
              leadingIcon="select_window"
            >
              {t('pdf_in_separate_tab')}
            </EnhancedDropdownItem>
          ) : (
            <BS5DetachDisabled />
          )}
        </DropdownMenu>
      </Dropdown>
    </>
  )
}

export default memo(LayoutDropdownButton)
