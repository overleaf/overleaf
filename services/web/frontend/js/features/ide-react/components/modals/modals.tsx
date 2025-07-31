import { memo } from 'react'
import ForceDisconnected from '@/features/ide-react/components/modals/force-disconnected'
import { UnsavedDocs } from '@/features/ide-react/components/unsaved-docs/unsaved-docs'
import SystemMessages from '@/shared/components/system-messages'
import { IdeRedesignSwitcherModal as IdeRedesignSwitcherModalLabs } from '@/features/ide-redesign/components/switcher-modal/modal'
import {
  IdeRedesignSwitcherModal as IdeRedesignSwitcherModalBeta,
  IdeRedesignIntroModal,
} from '@/features/ide-redesign/components/switcher-modal/beta-modal'
import { isNewEditorInBeta } from '@/features/ide-redesign/utils/new-editor-utils'

export const Modals = memo(() => {
  const newEditorBeta = isNewEditorInBeta()

  return (
    <>
      <ForceDisconnected />
      <UnsavedDocs />
      <SystemMessages />
      {newEditorBeta ? (
        <>
          <IdeRedesignIntroModal />
          <IdeRedesignSwitcherModalBeta />
        </>
      ) : (
        <IdeRedesignSwitcherModalLabs />
      )}
    </>
  )
})
Modals.displayName = 'Modals'
