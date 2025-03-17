import { memo } from 'react'
import ForceDisconnected from '@/features/ide-react/components/modals/force-disconnected'
import { UnsavedDocs } from '@/features/ide-react/components/unsaved-docs/unsaved-docs'
import SystemMessages from '@/shared/components/system-messages'
import { IdeRedesignSwitcherModal } from '@/features/ide-redesign/components/switcher-modal/modal'

export const Modals = memo(() => {
  return (
    <>
      <ForceDisconnected />
      <UnsavedDocs />
      <SystemMessages />
      <IdeRedesignSwitcherModal />
    </>
  )
})
Modals.displayName = 'Modals'
