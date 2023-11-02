import FileTreeRoot from '@/features/file-tree/components/file-tree-root'
import React, { useCallback, useState } from 'react'
import { useUserContext } from '@/shared/context/user-context'
import { useReferencesContext } from '@/features/ide-react/context/references-context'
import { useIdeReactContext } from '@/features/ide-react/context/ide-react-context'
import { useConnectionContext } from '@/features/ide-react/context/connection-context'
import {
  FileTreeDeleteHandler,
  FileTreeSelectHandler,
} from '@/features/ide-react/types/file-tree'
import { RefProviders } from '../../../../../types/user'

type FileTreeProps = {
  onInit: () => void
  onSelect: FileTreeSelectHandler
  onDelete: FileTreeDeleteHandler
}

export function FileTree({ onInit, onSelect, onDelete }: FileTreeProps) {
  const user = useUserContext()
  const { indexAllReferences } = useReferencesContext()
  const { setStartedFreeTrial } = useIdeReactContext()
  const { isConnected } = useConnectionContext()

  const [refProviders, setRefProviders] = useState<RefProviders>(
    () => user.refProviders || {}
  )

  function reindexReferences() {
    indexAllReferences(true)
  }

  const setRefProviderEnabled = useCallback(
    (provider: keyof RefProviders, value = true) => {
      setRefProviders(refProviders => ({ ...refProviders, [provider]: value }))
    },
    []
  )

  return (
    <div className="file-tree">
      <FileTreeRoot
        refProviders={refProviders}
        reindexReferences={reindexReferences}
        setRefProviderEnabled={setRefProviderEnabled}
        setStartedFreeTrial={setStartedFreeTrial}
        isConnected={isConnected}
        onInit={onInit}
        onSelect={onSelect}
        onDelete={onDelete}
      />
    </div>
  )
}
