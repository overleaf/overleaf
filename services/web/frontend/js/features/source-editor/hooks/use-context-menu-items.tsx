import {
  useCodeMirrorStateContext,
  useCodeMirrorViewContext,
} from '@/features/source-editor/components/codemirror-context'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'
import { useEditorPropertiesContext } from '@/features/ide-react/context/editor-properties-context'
import { useProjectContext } from '@/shared/context/project-context'
import useSynctex from '@/features/pdf-preview/hooks/use-synctex'
import { useDetachCompileContext } from '@/shared/context/detach-compile-context'
import { useLayoutContext } from '@/shared/context/layout-context'
import { useFeatureFlag } from '@/shared/context/split-test-context'
import { useTranslation } from 'react-i18next'
import { useCallback, useEffect, useRef } from 'react'
import {
  formatShortcut,
  useCommandRegistry,
} from '@/features/ide-react/context/command-registry-context'
import { closeContextMenuEffect } from '../extensions/context-menu'
import * as commands from '../extensions/toolbar/commands'
import {
  cutSelection,
  copySelection,
  pasteWithoutFormatting,
  pasteWithFormatting,
} from '../commands/clipboard'
import { isVisual } from '../extensions/visual/visual'

export const useContextMenuItems = () => {
  const view = useCodeMirrorViewContext()
  const state = useCodeMirrorStateContext()
  const permissions = usePermissionsContext()
  const { wantTrackChanges } = useEditorPropertiesContext()
  const { syncToPdf, syncToPdfInFlight, canSyncToPdf } = useSynctex()
  const { pdfUrl, pdfViewer } = useDetachCompileContext()
  const { detachRole } = useLayoutContext()
  const visualPreviewEnabled = useFeatureFlag('visual-preview')
  const { t } = useTranslation()
  const { shortcuts } = useCommandRegistry()
  const { features } = useProjectContext()
  const requestedPdfSyncRef = useRef(false)

  const closeMenu = useCallback(() => {
    view.dispatch({ effects: closeContextMenuEffect.of(null) })
  }, [view])

  // Handle closing the menu when it loses focus, e.g. click outside the editor
  const onToggle = (show: boolean) => {
    if (!show) {
      // Skip closing if a sync to PDF is in flight
      if (requestedPdfSyncRef.current) {
        return
      }

      closeMenu()
    }
  }

  // Wait for syncToPdf to finish before closing the menu
  useEffect(() => {
    if (requestedPdfSyncRef.current && !syncToPdfInFlight) {
      closeMenu()
      // Clear the synchronous flag when the close completes
      requestedPdfSyncRef.current = false
    }
  }, [syncToPdfInFlight, closeMenu])

  const hasSelection = !state.selection.main.empty
  const canEdit = permissions.write || permissions.trackedWrite
  const jumpToLocationInPdfEnabled =
    pdfUrl &&
    pdfViewer !== 'native' &&
    !detachRole &&
    !visualPreviewEnabled &&
    canSyncToPdf

  const wrapForContextMenu = useCallback(
    (command: () => Promise<boolean> | boolean) => async () => {
      const result = await command()
      if (result !== false) {
        view.focus()
        closeMenu()
      }
    },
    [view, closeMenu]
  )

  const inVisualMode = isVisual(view)

  const handleCut = wrapForContextMenu(() => cutSelection(view))
  const handleCopy = wrapForContextMenu(() => copySelection(view))
  const handlePaste = wrapForContextMenu(() =>
    inVisualMode ? pasteWithFormatting(view) : pasteWithoutFormatting(view)
  )
  const handlePasteSpecial = wrapForContextMenu(() =>
    inVisualMode ? pasteWithoutFormatting(view) : pasteWithFormatting(view)
  )
  const handleDelete = wrapForContextMenu(() => commands.deleteSelection(view))

  const handleToggleTrackChanges = wrapForContextMenu(() => {
    window.dispatchEvent(new Event('toggle-track-changes'))
    return true
  })

  const handleComment = wrapForContextMenu(() => {
    commands.addComment()
    return true
  })

  // Sync-to-PDF is special: it needs to wait for async completion before closing
  const handleSyncToPdf = useCallback(() => {
    requestedPdfSyncRef.current = true
    syncToPdf()
    view.focus()
  }, [syncToPdf, view])

  const getShortcut = useCallback(
    (id: string) => {
      const shortcut = shortcuts[id]?.[0]
      return shortcut ? formatShortcut(shortcut) : undefined
    },
    [shortcuts]
  )

  return {
    closeMenu,
    onToggle,
    menuItems: [
      {
        label: t('cut'),
        handler: handleCut,
        disabled: false,
        show: canEdit,
        shortcut: getShortcut('cut'),
      },
      {
        label: t('copy'),
        handler: handleCopy,
        disabled: false,
        show: true,
        shortcut: getShortcut('copy'),
      },
      {
        label: t('paste'),
        handler: handlePaste,
        disabled: false,
        show: canEdit,
        shortcut: getShortcut('paste'),
      },
      {
        label: inVisualMode
          ? t('paste_without_formatting')
          : t('paste_with_formatting'),
        handler: handlePasteSpecial,
        disabled: false,
        show: canEdit,
        shortcut: inVisualMode ? getShortcut('paste-special') : undefined,
      },
      {
        label: t('delete'),
        handler: handleDelete,
        disabled: !hasSelection,
        show: canEdit,
        shortcut: undefined,
      },
      {
        label: t('jump_to_location_in_pdf'),
        handler: handleSyncToPdf,
        disabled: syncToPdfInFlight,
        separatorAbove: true,
        show: jumpToLocationInPdfEnabled,
        shortcut: undefined,
      },
      {
        label: wantTrackChanges ? t('back_to_editing') : t('suggest_edits'),
        handler: handleToggleTrackChanges,
        // disable for now, future work opens upgrade modal
        disabled: !features.trackChanges,
        separatorAbove: true,
        show: canEdit,
        shortcut: getShortcut('toggle-track-changes'),
      },
      {
        label: t('comment'),
        handler: handleComment,
        disabled: !hasSelection,
        show: permissions.comment,
        shortcut: getShortcut('insert-comment'),
      },
    ].filter(item => item.show),
  }
}
