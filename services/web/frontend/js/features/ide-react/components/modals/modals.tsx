import { memo } from 'react'
import ForceDisconnected from '@/features/ide-react/components/modals/force-disconnected'
import { UnsavedDocs } from '@/features/ide-react/components/unsaved-docs/unsaved-docs'
import SystemMessages from '@/shared/components/system-messages'
import {
  IdeRedesignSwitcherModal,
  IdeRedesignIntroModal,
} from '@/features/ide-redesign/components/switcher-modal/beta-modal'

export const Modals = memo(() => {
  return (
    <>
      <ForceDisconnected />
      <UnsavedDocs />
      <SystemMessages />
      <IdeRedesignIntroModal />
      <IdeRedesignSwitcherModal />
    </>
  )
})
Modals.displayName = 'Modals'
