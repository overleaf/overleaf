import { createContext, FC, useContext, useState } from 'react'

type ContextMenuCoords = { top: number; left: number }

const FileTreeMainContext = createContext<
  | {
      refProviders: object
      reindexReferences: () => void
      setRefProviderEnabled: (provider: string, value: boolean) => void
      setStartedFreeTrial: (value: boolean) => void
      contextMenuCoords: ContextMenuCoords | null
      setContextMenuCoords: (value: ContextMenuCoords | null) => void
    }
  | undefined
>(undefined)

export function useFileTreeMainContext() {
  const context = useContext(FileTreeMainContext)

  if (!context) {
    throw new Error(
      'useFileTreeMainContext is only available inside FileTreeMainProvider'
    )
  }

  return context
}

export const FileTreeMainProvider: FC<{
  reindexReferences: () => void
  refProviders: object
  setRefProviderEnabled: (provider: string, value: boolean) => void
  setStartedFreeTrial: (value: boolean) => void
}> = ({
  refProviders,
  reindexReferences,
  setRefProviderEnabled,
  setStartedFreeTrial,
  children,
}) => {
  const [contextMenuCoords, setContextMenuCoords] =
    useState<ContextMenuCoords | null>(null)

  return (
    <FileTreeMainContext.Provider
      value={{
        refProviders,
        reindexReferences,
        setRefProviderEnabled,
        setStartedFreeTrial,
        contextMenuCoords,
        setContextMenuCoords,
      }}
    >
      {children}
    </FileTreeMainContext.Provider>
  )
}
