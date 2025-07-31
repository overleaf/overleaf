import { createContext, FC, useContext, useEffect, useMemo } from 'react'
import { ScopeValueStore } from '../../../../types/ide/scope-value-store'
import { ScopeEventEmitter } from '../../../../types/ide/scope-event-emitter'
import { Socket } from '@/features/ide-react/connection/types/socket'

export type Ide = {
  socket: Socket
}

type IdeContextValue = Ide & {
  scopeEventEmitter: ScopeEventEmitter
  unstableStore: ScopeValueStore
}

export const IdeContext = createContext<IdeContextValue | undefined>(undefined)

export const IdeProvider: FC<
  React.PropsWithChildren<{
    ide: Ide
    scopeEventEmitter: ScopeEventEmitter
    unstableStore: ScopeValueStore
  }>
> = ({ ide, scopeEventEmitter, unstableStore, children }) => {
  /**
   * Expose unstableStore via `window.overleaf.unstable.store`, so it can be accessed by external extensions.
   *
   * These properties are expected to be available:
   *   - `editor.view`
   *   - `editor.open_doc_name`,
   *   - `editor.open_doc_id`,
   *   - `settings.theme`
   *   - `settings.keybindings`
   *   - `settings.fontSize`
   *   - `settings.fontFamily`
   *   - `settings.lineHeight`
   */
  useEffect(() => {
    window.overleaf = {
      ...window.overleaf,
      unstable: {
        ...window.overleaf?.unstable,
        store: unstableStore,
      },
    }
  }, [unstableStore])

  const value = useMemo<IdeContextValue>(() => {
    return {
      ...ide,
      scopeEventEmitter,
      unstableStore,
    }
  }, [ide, scopeEventEmitter, unstableStore])

  return <IdeContext.Provider value={value}>{children}</IdeContext.Provider>
}

export function useIdeContext(): IdeContextValue {
  const context = useContext(IdeContext)

  if (!context) {
    throw new Error('useIdeContext is only available inside IdeProvider')
  }

  return context
}
