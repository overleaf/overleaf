import { MouseEventHandler, useCallback } from 'react'
import { useEditorAnalytics } from '@/shared/hooks/use-editor-analytics'
import { ErrorLevel, SourceLocation } from '../util/types'

const useHandleLogEntryClick = ({
  level,
  ruleId,
  sourceLocation,
  onSourceLocationClick,
}: {
  level: ErrorLevel | undefined
  ruleId: string | undefined
  sourceLocation: SourceLocation | undefined
  onSourceLocationClick?: (location: SourceLocation) => void
}) => {
  const { sendEvent } = useEditorAnalytics()

  const handleLogEntryLinkClick: MouseEventHandler<HTMLButtonElement> =
    useCallback(
      event => {
        event.preventDefault()

        if (onSourceLocationClick && sourceLocation) {
          onSourceLocationClick(sourceLocation)

          const parts = sourceLocation?.file?.split('.')
          const extension =
            parts?.length && parts?.length > 1 ? parts.pop() : ''
          sendEvent('log-entry-link-click', { level, ruleId, extension })
        }
      },
      [level, onSourceLocationClick, ruleId, sourceLocation, sendEvent]
    )

  return handleLogEntryLinkClick
}

export default useHandleLogEntryClick
