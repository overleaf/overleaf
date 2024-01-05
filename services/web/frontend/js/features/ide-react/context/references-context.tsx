// @ts-ignore
import CryptoJSSHA1 from 'crypto-js/sha1'
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
import _ from 'lodash'
import { postJSON } from '@/infrastructure/fetch-json'
import { ShareJsDoc } from '@/features/ide-react/editor/share-js-doc'
import useScopeValue from '@/shared/hooks/use-scope-value'
import { ReactScopeValueStore } from '@/features/ide-react/scope-value-store/react-scope-value-store'
import { useFileTreeData } from '@/shared/context/file-tree-data-context'
import { findDocEntityById } from '@/features/ide-react/util/find-doc-entity-by-id'
import { IdeEvents } from '@/features/ide-react/create-ide-event-emitter'

type References = {
  keys: string[]
}

type ReferencesContextValue = {
  indexReferencesIfDocModified: (
    doc: ShareJsDoc,
    shouldBroadcast: boolean
  ) => void
  indexAllReferences: (shouldBroadcast: boolean) => void
}

type IndexReferencesResponse = References

const ReferencesContext = createContext<ReferencesContextValue | undefined>(
  undefined
)

export function populateReferenceScope(store: ReactScopeValueStore) {
  store.set('$root._references', { keys: [] })
}

export const ReferencesProvider: FC = ({ children }) => {
  const { fileTreeData } = useFileTreeData()
  const { eventEmitter, projectId } = useIdeReactContext()
  const { socket } = useConnectionContext()

  const [references, setReferences] =
    useScopeValue<References>('$root._references')

  const [existingIndexHash, setExistingIndexHash] = useState<
    Record<string, { hash: string; timestamp: number }>
  >({})

  const storeReferencesKeys = useCallback(
    (newKeys: string[], replaceExistingKeys: boolean) => {
      const oldKeys = references.keys
      const keys = replaceExistingKeys ? newKeys : _.union(oldKeys, newKeys)
      window.dispatchEvent(
        new CustomEvent('project:references', {
          detail: keys,
        })
      )
      setReferences({ keys })
    },
    [references.keys, setReferences]
  )

  const indexAllReferences = useCallback(
    (shouldBroadcast: boolean) => {
      postJSON(`/project/${projectId}/references/indexAll`, {
        body: {
          shouldBroadcast,
        },
      }).then((response: IndexReferencesResponse) => {
        storeReferencesKeys(response.keys, true)
      })
    },
    [projectId, storeReferencesKeys]
  )

  const indexReferencesIfDocModified = useCallback(
    (doc: ShareJsDoc, shouldBroadcast: boolean) => {
      // avoid reindexing references if the bib file has not changed since the
      // last time they were indexed
      const docId = doc.doc_id
      const snapshot = doc._doc.snapshot
      const now = Date.now()
      const sha1 = CryptoJSSHA1(
        'blob ' + snapshot.length + '\x00' + snapshot
      ).toString()
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

  useEffect(() => {
    const handleShouldReindex = () => {
      indexAllReferences(true)
    }

    eventEmitter.on('references:should-reindex', handleShouldReindex)

    return () => {
      eventEmitter.off('references:should-reindex', handleShouldReindex)
    }
  }, [eventEmitter, indexAllReferences])

  useEffect(() => {
    const handleProjectJoined = () => {
      // We only need to grab the references when the editor first loads,
      // not on every reconnect
      socket.on('references:keys:updated', (keys, allDocs) =>
        storeReferencesKeys(keys, allDocs)
      )
      indexAllReferences(false)
    }

    eventEmitter.once('project:joined', handleProjectJoined)

    return () => {
      eventEmitter.off('project:joined', handleProjectJoined)
    }
  }, [eventEmitter, indexAllReferences, socket, storeReferencesKeys])

  const value = useMemo<ReferencesContextValue>(
    () => ({
      indexReferencesIfDocModified,
      indexAllReferences,
    }),
    [indexReferencesIfDocModified, indexAllReferences]
  )

  return (
    <ReferencesContext.Provider value={value}>
      {children}
    </ReferencesContext.Provider>
  )
}

export function useReferencesContext(): ReferencesContextValue {
  const context = useContext(ReferencesContext)

  if (!context) {
    throw new Error(
      'useReferencesContext is only available inside ReferencesProvider'
    )
  }

  return context
}
