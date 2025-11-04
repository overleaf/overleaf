import { useCallback } from 'react'
import { useLayoutContext } from '@/shared/context/layout-context'
import { useEditorContext } from '@/shared/context/editor-context'
import useEventListener from '@/shared/hooks/use-event-listener'
import { useIsNewEditorEnabled } from '@/features/ide-redesign/utils/new-editor-utils'

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
  const newEditor = useIsNewEditorEnabled()
  const { hasPremiumSuggestion } = useEditorContext()

  const selectLogOldLogs = useCallback((id: string, suggestFix: boolean) => {
    window.setTimeout(() => {
      const element = document.querySelector(
        `.log-entry[data-log-entry-id="${id}"]`
      )

      if (element) {
        scrollIntoView(element)

        if (suggestFix) {
          // if they are paywalled, click that instead
          const paywall = document.querySelector<HTMLButtonElement>(
            'button[data-action="assistant-paywall-show"]'
          )

          if (paywall) {
            scrollIntoView(paywall)
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
  }, [])

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
    [hasPremiumSuggestion]
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

      if (newEditor) {
        selectLogNewLogs(
          id,
          Boolean(suggestFix),
          Boolean(showPaywallIfOutOfSuggestions)
        )
      } else {
        selectLogOldLogs(id, Boolean(suggestFix))
      }
    },
    [openLogs, selectLogNewLogs, selectLogOldLogs, newEditor]
  )

  useEventListener(
    'editor:view-compile-log-entry',
    handleViewCompileLogEntryEvent
  )
}
