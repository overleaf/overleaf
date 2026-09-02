import { FC } from 'react'
import { UnsavedDocsLockedAlert } from '@/features/ide-react/components/unsaved-docs/unsaved-docs-locked-alert'
import { UnsavedDocsAlert } from '@/features/ide-react/components/unsaved-docs/unsaved-docs-alert'
import { createPortal } from 'react-dom'
import { useGlobalAlertsContainer } from '@/features/ide-react/context/global-alerts-context'
import { useUnsavedDocsContext } from '@/features/ide-react/context/unsaved-docs-context'
import { useFeatureFlag } from '@/shared/context/split-test-context'

export const UnsavedDocs: FC = () => {
  const { unsavedDocs, isLocked } = useUnsavedDocsContext()
  const globalAlertsContainer = useGlobalAlertsContainer()
  const improvedFlakyConnections = useFeatureFlag(
    'intermittent-connection-improvements'
  )

  if (!globalAlertsContainer) {
    return null
  }

  return (
    <>
      {isLocked &&
        createPortal(<UnsavedDocsLockedAlert />, globalAlertsContainer)}

      {!improvedFlakyConnections &&
        unsavedDocs.size > 0 &&
        createPortal(
          <UnsavedDocsAlert unsavedDocs={unsavedDocs} />,
          globalAlertsContainer
        )}
    </>
  )
}
