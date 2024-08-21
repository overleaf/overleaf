import {
  createContext,
  FC,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { Snapshot } from 'overleaf-editor-core'
import { useProjectContext } from '@/shared/context/project-context'
import { debugConsole } from '@/utils/debugging'
import importOverleafModules from '../../../../macros/import-overleaf-module.macro'
import { Folder } from '../../../../../types/folder'

export const StubSnapshotUtils = {
  SnapshotUpdater: class SnapshotUpdater {
    // eslint-disable-next-line no-useless-constructor
    constructor(readonly projectId: string) {}
    refresh(): Promise<{ snapshot: Snapshot; snapshotVersion: number }> {
      throw new Error('not implemented')
    }

    abort(): void {
      throw new Error('not implemented')
    }
  },
  buildFileTree(snapshot: Snapshot): Folder {
    throw new Error('not implemented')
  },
  createFolder(_id: string, name: string): Folder {
    throw new Error('not implemented')
  },
}

const { SnapshotUpdater } =
  (importOverleafModules('snapshotUtils')[0]
    ?.import as typeof StubSnapshotUtils) || StubSnapshotUtils

export type SnapshotLoadingState = '' | 'loading' | 'error'

export const SnapshotContext = createContext<
  | {
      snapshotVersion: number
      snapshot?: Snapshot
      snapshotLoadingState: SnapshotLoadingState

      fileTreeFromHistory: boolean
      setFileTreeFromHistory: (v: boolean) => void
    }
  | undefined
>(undefined)

export const SnapshotProvider: FC = ({ children }) => {
  const { _id: projectId } = useProjectContext()
  const [snapshotLoadingState, setSnapshotLoadingState] =
    useState<SnapshotLoadingState>('')
  const [snapshotUpdater] = useState(() => new SnapshotUpdater(projectId))
  const [snapshot, setSnapshot] = useState<Snapshot>()
  const [snapshotVersion, setSnapshotVersion] = useState(-1)
  const [fileTreeFromHistory, setFileTreeFromHistory] = useState(false)

  useEffect(() => {
    if (!fileTreeFromHistory) return

    let stop = false
    let handle: number
    const refresh = () => {
      setSnapshotLoadingState('loading')
      snapshotUpdater
        .refresh()
        .then(({ snapshot, snapshotVersion }) => {
          setSnapshot(snapshot)
          setSnapshotVersion(snapshotVersion)
          setSnapshotLoadingState('')
        })
        .catch(err => {
          debugConsole.error(err)
          setSnapshotLoadingState('error')
        })
        .finally(() => {
          if (stop) return
          // use a chain of timeouts to avoid concurrent updates
          handle = window.setTimeout(refresh, 30_000)
        })
    }

    refresh()
    return () => {
      stop = true
      snapshotUpdater.abort()
      clearInterval(handle)
    }
  }, [projectId, fileTreeFromHistory, snapshotUpdater])

  const value = useMemo(
    () => ({
      snapshot,
      snapshotVersion,
      snapshotLoadingState,
      fileTreeFromHistory,
      setFileTreeFromHistory,
    }),
    [
      snapshot,
      snapshotVersion,
      snapshotLoadingState,
      fileTreeFromHistory,
      setFileTreeFromHistory,
    ]
  )

  return (
    <SnapshotContext.Provider value={value}>
      {children}
    </SnapshotContext.Provider>
  )
}

export function useSnapshotContext() {
  const context = useContext(SnapshotContext)
  if (!context) {
    throw new Error(
      'useSnapshotContext is only available within SnapshotProvider'
    )
  }
  return context
}
