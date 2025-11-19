import { memo } from 'react'
import ForceDisconnected from '@/features/ide-react/components/modals/force-disconnected'
import { UnsavedDocs } from '@/features/ide-react/components/unsaved-docs/unsaved-docs'
import SystemMessages from '@/shared/components/system-messages'
import NewEditorPromoModal from '@/features/ide-redesign/components/new-editor-promo-modal'
import NewEditorIntroModal from '@/features/ide-redesign/components/new-editor-intro-modal'

export const Modals = memo(() => {
  return (
    <>
      <ForceDisconnected />
      <UnsavedDocs />
      <SystemMessages />
      <NewEditorPromoModal />
      <NewEditorIntroModal />
    </>
  )
})
Modals.displayName = 'Modals'
