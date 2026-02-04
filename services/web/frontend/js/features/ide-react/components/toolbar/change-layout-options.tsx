import {
  DropdownItem,
  DropdownHeader,
} from '@/shared/components/dropdown/dropdown-menu'
import {
  IdeLayout,
  IdeView,
  useLayoutContext,
} from '@/shared/context/layout-context'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { DetachRole } from '@/shared/context/detach-context'
import OLSpinner from '@/shared/components/ol/ol-spinner'
import { isMac } from '@/shared/utils/os'
import { Shortcut } from '@/shared/components/shortcut'
import classNames from 'classnames'

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
  trailingIcon,
  onClick,
  children,
}: {
  active: boolean
  leadingIcon: React.ReactNode
  trailingIcon?: React.ReactNode
  onClick: () => void
  children: React.ReactNode
  processing?: boolean
  disabled?: boolean
}) => {
  if (processing) {
    leadingIcon = <OLSpinner size="sm" />
  } else if (active) {
    leadingIcon = 'check'
  }

  return (
    <DropdownItem
      active={active}
      aria-current={active}
      disabled={disabled}
      onClick={onClick}
      leadingIcon={leadingIcon}
      trailingIcon={trailingIcon}
      className={classNames({ 'dropdown-item-wide': isMac })}
    >
      {children}
    </DropdownItem>
  )
}

const shortcuts: Record<LayoutOption, string[] | null> = isMac
  ? {
      editorOnly: ['⌃', '⌘', '←'],
      pdfOnly: ['⌃', '⌘', '→'],
      sideBySide: ['⌃', '⌘', '↓'],
      detachedPdf: ['⌃', '⌘', '↑'],
    }
  : {
      editorOnly: null,
      pdfOnly: null,
      sideBySide: null,
      detachedPdf: null,
    }

export default function ChangeLayoutOptions() {
  const {
    detachIsLinked,
    detachRole,
    view,
    pdfLayout,
    handleChangeLayout,
    handleDetach,
  } = useLayoutContext()

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
        trailingIcon={
          shortcuts.sideBySide && <Shortcut keys={shortcuts.sideBySide} />
        }
      >
        {t('split_view')}
      </LayoutDropdownItem>
      <LayoutDropdownItem
        onClick={() => handleChangeLayout('flat', 'editor')}
        active={activeLayoutOption === 'editorOnly'}
        leadingIcon="edit"
        trailingIcon={
          shortcuts.editorOnly && <Shortcut keys={shortcuts.editorOnly} />
        }
      >
        {t('editor_only')}
      </LayoutDropdownItem>
      <LayoutDropdownItem
        onClick={() => handleChangeLayout('flat', 'pdf')}
        active={activeLayoutOption === 'pdfOnly'}
        leadingIcon="picture_as_pdf"
        trailingIcon={
          shortcuts.pdfOnly && <Shortcut keys={shortcuts.pdfOnly} />
        }
      >
        {t('pdf_only')}
      </LayoutDropdownItem>
      <LayoutDropdownItem
        onClick={() => handleDetach()}
        active={activeLayoutOption === 'detachedPdf' && detachIsLinked}
        disabled={!detachable}
        leadingIcon="open_in_new"
        trailingIcon={
          shortcuts.detachedPdf && <Shortcut keys={shortcuts.detachedPdf} />
        }
        processing={waitingForDetachedLink}
      >
        {t('open_pdf_in_separate_tab')}
      </LayoutDropdownItem>
    </>
  )
}
