import { createContext, FC, useContext, useState } from 'react'

type ContextMenuCoords = { top: number; left: number }

const FileTreeMainContext = createContext<
  | {
      refProviders: object
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

export const FileTreeMainProvider: FC<
  React.PropsWithChildren<{
    refProviders: object
    setRefProviderEnabled: (provider: string, value: boolean) => void
    setStartedFreeTrial: (value: boolean) => void
  }>
> = ({
  refProviders,
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
