import { generateSHA1Hash } from '../../../shared/utils/sha1'
import {
  createContext,
  useContext,
  useEffect,
  FC,
  useCallback,
  useMemo,
  useState,
  useRef,
} from 'react'
import { useIdeReactContext } from '@/features/ide-react/context/ide-react-context'
import { useConnectionContext } from '@/features/ide-react/context/connection-context'
import { ShareJsDoc } from '@/features/ide-react/editor/share-js-doc'
import { useFileTreeData } from '@/shared/context/file-tree-data-context'
import { findDocEntityById } from '@/features/ide-react/util/find-doc-entity-by-id'
import { IdeEvents } from '@/features/ide-react/create-ide-event-emitter'
import useEventListener from '@/shared/hooks/use-event-listener'
import { useProjectContext } from '@/shared/context/project-context'
import { useEditorManagerContext } from './editor-manager-context'
import { signalWithTimeout } from '@/utils/abort-signal'
import { postJSON } from '@/infrastructure/fetch-json'
import { debugConsole } from '@/utils/debugging'
import type { ReferenceIndexer } from '../references/reference-indexer'
import { AdvancedReferenceSearchResult } from '@/features/ide-react/references/types'
import clientId from '@/utils/client-id'
import { sendMBOnce } from '@/infrastructure/event-tracking'

export const ReferencesContext = createContext<
  | {
      referenceKeys: Set<string>
      indexAllReferences: (shouldBroadcast: boolean) => Promise<void>
      searchLocalReferences: (
        query: string
      ) => Promise<AdvancedReferenceSearchResult>
    }
  | undefined
>(undefined)

export const ReferencesProvider: FC<React.PropsWithChildren> = ({
  children,
}) => {
  const { fileTreeData } = useFileTreeData()
  const { eventEmitter, projectId, permissionsLevel, projectJoined } =
    useIdeReactContext()
  const { socket } = useConnectionContext()
  const { projectSnapshot } = useProjectContext()
  const { openDocs } = useEditorManagerContext()
  const abortControllerRef = useRef<AbortController | null>(null)

  const [referenceKeys, setReferenceKeys] = useState(new Set<string>())

  const [existingIndexHash, setExistingIndexHash] = useState<
    Record<string, { hash: string; timestamp: number }>
  >({})

  const indexerRef = useRef<Promise<ReferenceIndexer> | null>(null)
  if (indexerRef.current === null) {
    indexerRef.current = import('../references/reference-indexer').then(
      m => new m.ReferenceIndexer()
    )
  }

  const indexAllReferences = useCallback(
    async (shouldBroadcast: boolean) => {
      if (permissionsLevel === 'readOnly') {
        // Not going to search the references, so let's not index them.
        return
      }
      sendMBOnce('client-side-references-index')
      abortControllerRef.current?.abort()

      if (!indexerRef.current) {
        return
      }

      abortControllerRef.current = new AbortController()
      const signal = abortControllerRef.current.signal

      await openDocs.awaitBufferedOps(signalWithTimeout(signal, 5000))
      await projectSnapshot.refresh()

      if (signal.aborted) {
        return
      }

      const indexer = await indexerRef.current
      const keys = await indexer.updateFromSnapshot(projectSnapshot, { signal })
      if (signal.aborted) {
        return
      }
      setReferenceKeys(keys)
      if (shouldBroadcast) {
        // Inform other clients about change in keys
        await postJSON(`/project/${projectId}/references/indexAll`, {
          body: { shouldBroadcast: true, clientId: clientId.get() },
        }).catch(error => {
          // allow the request to fail
          debugConsole.error(error)
        })
      }
    },
    [projectSnapshot, openDocs, projectId, permissionsLevel]
  )

  const indexReferencesIfDocModified = useCallback(
    (doc: ShareJsDoc, shouldBroadcast: boolean) => {
      // avoid reindexing references if the bib file has not changed since the
      // last time they were indexed
      const docId = doc.doc_id
      const snapshot = doc.getSnapshot()
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

  const doneInitialIndex = useRef(false)
  useEffect(() => {
    // We wait for projectJoined to ensure that the correct permission level
    // has been received and stored on the client.
    if (projectJoined && !doneInitialIndex.current) {
      doneInitialIndex.current = true
      indexAllReferences(false)
    }

    if (projectJoined && socket) {
      const processUpdatedReferenceKeys = (
        keys: string[],
        allDocs: boolean,
        refresherId: string
      ) => {
        if (refresherId === clientId.get()) {
          // We asked for this broadcast, so we must have already done the indexing
          return
        }
        indexAllReferences(false)
      }

      socket.on('references:keys:updated', processUpdatedReferenceKeys)
      return () => {
        socket.removeListener(
          'references:keys:updated',
          processUpdatedReferenceKeys
        )
      }
    }
  }, [projectJoined, indexAllReferences, socket])

  const searchLocalReferences = useCallback(
    async (query: string): Promise<AdvancedReferenceSearchResult> => {
      if (!indexerRef.current) {
        return { hits: [] }
      }
      const indexer = await indexerRef.current
      return await indexer.search(query)
    },
    []
  )

  const value = useMemo(
    () => ({
      referenceKeys,
      indexAllReferences,
      searchLocalReferences,
    }),
    [indexAllReferences, referenceKeys, searchLocalReferences]
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
