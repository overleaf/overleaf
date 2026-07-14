import React, { type FC, type PropsWithChildren } from 'react'
import {
  EditorManager,
  EditorManagerContext,
} from '@/features/ide-react/context/editor-manager-context'

export function makeEditorManagerProviderWithStaleDocs(
  pendingAt: number,
  stubs?: {
    openDocWithId?: any
    openDoc?: any
    openFileWithId?: any
  }
) {
  const staleDocs = [
    {
      doc_id: 'stale-doc',
      getInflightOpCreatedAt: () => undefined,
      getPendingOpCreatedAt: () => pendingAt,
    },
  ]
  const EditorManagerProviderWithStaleDocs: FC<PropsWithChildren> = ({
    children,
  }) => {
    const value = {
      getEditorType: () => null,
      getCurrentDocValue: () => null,
      getCurrentDocumentId: () => null,
      setIgnoringExternalUpdates: () => {},
      openDocWithId: stubs?.openDocWithId ?? cy.stub().resolves(),
      openDoc: stubs?.openDoc ?? cy.stub().resolves(),
      openDocs: {
        awaitBufferedOps: cy.stub().resolves(),
        unsavedDocs: () => staleDocs,
        hasUnsavedChanges: () => true,
        getUnsavedOpsSize: () => ({
          pendingOpsLength: 0,
          inflightOpsLength: 0,
        }),
      } as any,
      openFileWithId: stubs?.openFileWithId ?? cy.stub(),
      openInitialDoc: cy.stub().resolves(),
      isLoading: false,
      jumpToLine: () => {},
      debugTimers: { current: {} },
    } as unknown as EditorManager
    return (
      <EditorManagerContext.Provider value={value}>
        {children}
      </EditorManagerContext.Provider>
    )
  }
  return EditorManagerProviderWithStaleDocs
}
