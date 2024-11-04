import { useEffect } from 'react'
import { useLayoutContext } from '@/shared/context/layout-context'

/**
 * This hook adds an event listener for events dispatched from the editor to the compile logs pane
 */
export const useLogEvents = (setShowLogs: (show: boolean) => void) => {
  const { pdfLayout, setView } = useLayoutContext()

  useEffect(() => {
    const listener = (event: Event) => {
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
    }

    window.addEventListener('editor:view-compile-log-entry', listener)

    return () => {
      window.removeEventListener('editor:view-compile-log-entry', listener)
    }
  }, [pdfLayout, setView, setShowLogs])
}
