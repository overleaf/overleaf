import { useCallback, useEffect } from 'react'
import { useLayoutContext } from '@/shared/context/layout-context'
import { useIsNewEditorEnabled } from '@/features/ide-redesign/utils/new-editor-utils'
import { useRailContext } from '@/features/ide-redesign/contexts/rail-context'
import { useEditorContext } from '@/shared/context/editor-context'

/**
 * This hook adds an event listener for events dispatched from the editor to the compile logs pane
 */
export const useLogEvents = (setShowLogs: (show: boolean) => void) => {
  const { pdfLayout, setView } = useLayoutContext()
  const newEditor = useIsNewEditorEnabled()
  const { openTab: openRailTab } = useRailContext()
  const { hasPremiumSuggestion } = useEditorContext()

  const handleViewCompileLogEntryEventOldEditor = useCallback(
    (event: Event) => {
      const { id, suggestFix } = (
        event as CustomEvent<{ id: string; suggestFix?: boolean }>
      ).detail

      setShowLogs(true)

      if (pdfLayout === 'flat') {
        setView('pdf')
      }

      window.setTimeout(() => {
        const element = document.querySelector(
          `.log-entry[data-log-entry-id="${id}"]`
        )

        if (element) {
          element.scrollIntoView({
            block: 'start',
            inline: 'nearest',
          })

          if (suggestFix) {
            // if they are paywalled, click that instead
            const paywall = document.querySelector<HTMLButtonElement>(
              'button[data-action="assistant-paywall-show"]'
            )

            if (paywall) {
              paywall.scrollIntoView({
                block: 'start',
                inline: 'nearest',
              })
              paywall.click()
            } else {
              element
                .querySelector<HTMLButtonElement>(
                  'button[data-action="suggest-fix"]'
                )
                ?.click()
            }
          }
        }
      })
    },
    [pdfLayout, setView, setShowLogs]
  )

  const handleViewCompileLogEntryEventNewEditor = useCallback(
    (event: Event) => {
      const { id, suggestFix, showPaywallIfOutOfSuggestions } = (
        event as CustomEvent<{
          id: string
          suggestFix?: boolean
          showPaywallIfOutOfSuggestions?: boolean
        }>
      ).detail

      openRailTab('errors')

      window.setTimeout(() => {
        const logEntry = document.querySelector(
          `.log-entry[data-log-entry-id="${id}"]`
        )

        if (logEntry) {
          logEntry.scrollIntoView({
            block: 'start',
            inline: 'nearest',
          })

          const expandCollapseButton =
            logEntry.querySelector<HTMLButtonElement>(
              'button[data-action="expand-collapse"]'
            )

          const collapsed = expandCollapseButton?.dataset.collapsed === 'true'

          if (collapsed) {
            expandCollapseButton.click()
          }

          if (suggestFix) {
            if (hasPremiumSuggestion) {
              logEntry
                .querySelector<HTMLButtonElement>(
                  'button[data-action="suggest-fix"]'
                )
                ?.click()
            } else if (showPaywallIfOutOfSuggestions) {
              window.dispatchEvent(
                new CustomEvent('aiAssist:showPaywall', {
                  detail: { origin: 'suggest-fix' },
                })
              )
            }
          }
        }
      })
    },
    [openRailTab, hasPremiumSuggestion]
  )

  useEffect(() => {
    const listener = (event: Event) => {
      if (newEditor) {
        handleViewCompileLogEntryEventNewEditor(event)
      } else {
        handleViewCompileLogEntryEventOldEditor(event)
      }
    }

    window.addEventListener('editor:view-compile-log-entry', listener)

    return () => {
      window.removeEventListener('editor:view-compile-log-entry', listener)
    }
  }, [
    handleViewCompileLogEntryEventNewEditor,
    handleViewCompileLogEntryEventOldEditor,
    newEditor,
  ])
}
