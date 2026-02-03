import { memo } from 'react'
import ForceDisconnected from '@/features/ide-react/components/modals/force-disconnected'
import { UnsavedDocs } from '@/features/ide-react/components/unsaved-docs/unsaved-docs'
import SystemMessages from '@/shared/components/system-messages'
import NewEditorOptOutIntroModal from '@/features/ide-redesign/components/new-editor-opt-out-intro-modal'
import ViewOnlyAccessModal from '@/features/share-project-modal/components/view-only-access-modal'

export const Modals = memo(() => {
  return (
    <>
      <ForceDisconnected />
      <UnsavedDocs />
      <SystemMessages />
      <NewEditorOptOutIntroModal />
      <ViewOnlyAccessModal />
    </>
  )
})
Modals.displayName = 'Modals'
