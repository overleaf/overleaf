import { useCallback } from 'react'
import { useLayoutContext } from '@/shared/context/layout-context'
import { useEditorContext } from '@/shared/context/editor-context'
import useEventListener from '@/shared/hooks/use-event-listener'

function scrollIntoView(element: Element) {
  setTimeout(() => {
    element.scrollIntoView({
      block: 'start',
      inline: 'nearest',
    })
  })
}

/**
 * This hook adds an event listener for events dispatched from the editor to the compile logs pane
 */
export const useLogEvents = (setShowLogs: (show: boolean) => void) => {
  const { pdfLayout, setView } = useLayoutContext()
  const { hasSuggestionsLeft } = useEditorContext()

  const selectLogNewLogs = useCallback(
    (
      id: string,
      suggestFix: boolean,
      showPaywallIfOutOfSuggestions: boolean
    ) => {
      window.setTimeout(() => {
        const logEntry = document.querySelector(
          `.log-entry[data-log-entry-id="${id}"]`
        )

        if (logEntry) {
          scrollIntoView(logEntry)

          const expandCollapseButton = logEntry.querySelector<HTMLElement>(
            '[data-action="expand-collapse"]'
          )

          const collapsed = expandCollapseButton?.dataset.collapsed === 'true'

          if (collapsed) {
            expandCollapseButton.click()
          }

          if (suggestFix) {
            if (hasSuggestionsLeft) {
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
    [hasSuggestionsLeft]
  )

  const openLogs = useCallback(() => {
    setShowLogs(true)

    if (pdfLayout === 'flat') {
      setView('pdf')
    }
  }, [pdfLayout, setView, setShowLogs])

  const handleViewCompileLogEntryEvent = useCallback(
    (event: Event) => {
      const { id, suggestFix, showPaywallIfOutOfSuggestions } = (
        event as CustomEvent<{
          id: string
          suggestFix?: boolean
          showPaywallIfOutOfSuggestions?: boolean
        }>
      ).detail

      openLogs()

      selectLogNewLogs(
        id,
        Boolean(suggestFix),
        Boolean(showPaywallIfOutOfSuggestions)
      )
    },
    [openLogs, selectLogNewLogs]
  )

  useEventListener(
    'editor:view-compile-log-entry',
    handleViewCompileLogEntryEvent
  )
}
