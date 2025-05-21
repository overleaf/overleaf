import {
  DropdownItem,
  DropdownHeader,
} from '@/features/ui/components/bootstrap-5/dropdown-menu'
import {
  IdeLayout,
  IdeView,
  useLayoutContext,
} from '@/shared/context/layout-context'
import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import useEventListener from '@/shared/hooks/use-event-listener'
import { DetachRole } from '@/shared/context/detach-context'
import { Spinner } from 'react-bootstrap'
import { useEditorAnalytics } from '@/shared/hooks/use-editor-analytics'

type LayoutOption = 'sideBySide' | 'editorOnly' | 'pdfOnly' | 'detachedPdf'

const getActiveLayoutOption = ({
  pdfLayout,
  view,
  detachRole,
}: {
  pdfLayout: IdeLayout
  view: IdeView | null
  detachRole?: DetachRole
}): LayoutOption | null => {
  if (view === 'history') {
    return null
  }

  if (detachRole === 'detacher') {
    return 'detachedPdf'
  }

  if (pdfLayout === 'flat' && (view === 'editor' || view === 'file')) {
    return 'editorOnly'
  }

  if (pdfLayout === 'flat' && view === 'pdf') {
    return 'pdfOnly'
  }

  if (pdfLayout === 'sideBySide') {
    return 'sideBySide'
  }

  return null
}

const LayoutDropdownItem = ({
  active,
  disabled = false,
  processing = false,
  leadingIcon,
  onClick,
  children,
}: {
  active: boolean
  leadingIcon: string
  onClick: () => void
  children: React.ReactNode
  processing?: boolean
  disabled?: boolean
}) => {
  let trailingIcon: string | React.ReactNode | null = null
  if (processing) {
    trailingIcon = (
      <Spinner animation="border" aria-hidden="true" size="sm" role="status" />
    )
  } else if (active) {
    trailingIcon = 'check'
  }

  return (
    <DropdownItem
      active={active}
      aria-current={active}
      trailingIcon={trailingIcon}
      disabled={disabled}
      onClick={onClick}
      leadingIcon={leadingIcon}
    >
      {children}
    </DropdownItem>
  )
}

export default function ChangeLayoutOptions() {
  const { sendEvent } = useEditorAnalytics()
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
    sendEvent('project-layout-detach')
  }, [detach, sendEvent])

  const handleReattach = useCallback(() => {
    if (detachRole !== 'detacher') {
      return
    }
    reattach()
    sendEvent('project-layout-reattach')
  }, [detachRole, reattach, sendEvent])

  // reattach when the PDF pane opens
  useEventListener('ui:pdf-open', handleReattach)

  const handleChangeLayout = useCallback(
    (newLayout: IdeLayout, newView?: IdeView) => {
      handleReattach()
      changeLayout(newLayout, newView)
      sendEvent('project-layout-change', {
        layout: newLayout,
        view: newView,
      })
    },
    [changeLayout, handleReattach, sendEvent]
  )

  const { t } = useTranslation()

  const detachable = 'BroadcastChannel' in window

  const activeLayoutOption = getActiveLayoutOption({
    pdfLayout,
    view,
    detachRole,
  })

  const waitingForDetachedLink = !detachIsLinked && detachRole === 'detacher'

  return (
    <>
      <DropdownHeader>{t('layout_options')}</DropdownHeader>
      <LayoutDropdownItem
        onClick={() => handleChangeLayout('sideBySide')}
        active={activeLayoutOption === 'sideBySide'}
        leadingIcon="splitscreen_right"
      >
        {t('split_view')}
      </LayoutDropdownItem>
      <LayoutDropdownItem
        onClick={() => handleChangeLayout('flat', 'editor')}
        active={activeLayoutOption === 'editorOnly'}
        leadingIcon="edit"
      >
        {t('editor_only')}
      </LayoutDropdownItem>
      <LayoutDropdownItem
        onClick={() => handleChangeLayout('flat', 'pdf')}
        active={activeLayoutOption === 'pdfOnly'}
        leadingIcon="picture_as_pdf"
      >
        {t('pdf_only')}
      </LayoutDropdownItem>
      <LayoutDropdownItem
        onClick={() => handleDetach()}
        active={activeLayoutOption === 'detachedPdf' && detachIsLinked}
        disabled={!detachable}
        leadingIcon="open_in_new"
        processing={waitingForDetachedLink}
      >
        {t('open_pdf_in_separate_tab')}
      </LayoutDropdownItem>
    </>
  )
}
