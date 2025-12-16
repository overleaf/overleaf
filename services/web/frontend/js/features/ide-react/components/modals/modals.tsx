import { memo } from 'react'
import ForceDisconnected from '@/features/ide-react/components/modals/force-disconnected'
import { UnsavedDocs } from '@/features/ide-react/components/unsaved-docs/unsaved-docs'
import SystemMessages from '@/shared/components/system-messages'
import NewEditorOptOutIntroModal from '@/features/ide-redesign/components/new-editor-opt-out-intro-modal'

export const Modals = memo(() => {
  return (
    <>
      <ForceDisconnected />
      <UnsavedDocs />
      <SystemMessages />
      <NewEditorOptOutIntroModal />
    </>
  )
})
Modals.displayName = 'Modals'
