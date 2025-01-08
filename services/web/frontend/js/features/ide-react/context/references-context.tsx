import { generateSHA1Hash } from '../../../shared/utils/sha1'
import {
  createContext,
  useContext,
  useEffect,
  FC,
  useCallback,
  useMemo,
  useState,
} from 'react'
import { useIdeReactContext } from '@/features/ide-react/context/ide-react-context'
import { useConnectionContext } from '@/features/ide-react/context/connection-context'
import { postJSON } from '@/infrastructure/fetch-json'
import { ShareJsDoc } from '@/features/ide-react/editor/share-js-doc'
import { useFileTreeData } from '@/shared/context/file-tree-data-context'
import { findDocEntityById } from '@/features/ide-react/util/find-doc-entity-by-id'
import { IdeEvents } from '@/features/ide-react/create-ide-event-emitter'
import { debugConsole } from '@/utils/debugging'
import useEventListener from '@/shared/hooks/use-event-listener'

export const ReferencesContext = createContext<
  | {
      referenceKeys: Set<string>
      indexAllReferences: (shouldBroadcast: boolean) => void
    }
  | undefined
>(undefined)

export const ReferencesProvider: FC = ({ children }) => {
  const { fileTreeData } = useFileTreeData()
  const { eventEmitter, projectId } = useIdeReactContext()
  const { socket } = useConnectionContext()

  const [referenceKeys, setReferenceKeys] = useState(new Set<string>())

  const [existingIndexHash, setExistingIndexHash] = useState<
    Record<string, { hash: string; timestamp: number }>
  >({})

  const indexAllReferences = useCallback(
    (shouldBroadcast: boolean) => {
      postJSON(`/project/${projectId}/references/indexAll`, {
        body: {
          shouldBroadcast,
        },
      })
        .then((response: { keys: string[] }) => {
          setReferenceKeys(new Set(response.keys))
        })
        .catch(error => {
          // allow the request to fail
          debugConsole.error(error)
        })
    },
    [projectId]
  )

  const indexReferencesIfDocModified = useCallback(
    (doc: ShareJsDoc, shouldBroadcast: boolean) => {
      // avoid reindexing references if the bib file has not changed since the
      // last time they were indexed
      const docId = doc.doc_id
      const snapshot = doc._doc.snapshot
      const now = Date.now()
      const sha1 = generateSHA1Hash(
        'blob ' + snapshot.length + '\x00' + snapshot
      )
      const CACHE_LIFETIME = 6 * 3600 * 1000 // allow reindexing every 6 hours
      const cacheEntry = existingIndexHash[docId]
      const isCached =
        cacheEntry &&
        cacheEntry.timestamp > now - CACHE_LIFETIME &&
        cacheEntry.hash === sha1
      if (!isCached) {
        indexAllReferences(shouldBroadcast)
        setExistingIndexHash(existingIndexHash => ({
          ...existingIndexHash,
          [docId]: { hash: sha1, timestamp: now },
        }))
      }
    },
    [existingIndexHash, indexAllReferences]
  )

  useEffect(() => {
    const handleDocClosed = ({
      detail: [doc],
    }: CustomEvent<IdeEvents['document:closed']>) => {
      if (
        doc.doc_id &&
        findDocEntityById(fileTreeData, doc.doc_id)?.name?.endsWith('.bib')
      ) {
        indexReferencesIfDocModified(doc, true)
      }
    }

    eventEmitter.on('document:closed', handleDocClosed)

    return () => {
      eventEmitter.off('document:closed', handleDocClosed)
    }
  }, [eventEmitter, fileTreeData, indexReferencesIfDocModified])

  useEventListener(
    'reference:added',
    useCallback(() => {
      indexAllReferences(true)
    }, [indexAllReferences])
  )

  useEffect(() => {
    const handleProjectJoined = () => {
      // We only need to grab the references when the editor first loads,
      // not on every reconnect
      socket.on('references:keys:updated', (keys, allDocs) => {
        setReferenceKeys(oldKeys =>
          allDocs ? new Set(keys) : new Set([...oldKeys, ...keys])
        )
      })
      indexAllReferences(false)
    }

    eventEmitter.once('project:joined', handleProjectJoined)

    return () => {
      eventEmitter.off('project:joined', handleProjectJoined)
    }
  }, [eventEmitter, indexAllReferences, socket])

  const value = useMemo(
    () => ({
      referenceKeys,
      indexAllReferences,
    }),
    [indexAllReferences, referenceKeys]
  )

  return (
    <ReferencesContext.Provider value={value}>
      {children}
    </ReferencesContext.Provider>
  )
}

export function useReferencesContext() {
  const context = useContext(ReferencesContext)

  if (!context) {
    throw new Error(
      'useReferencesContext is only available inside ReferencesProvider'
    )
  }

  return context
}
