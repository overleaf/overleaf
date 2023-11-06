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
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import _ from 'lodash'
import { getJSON, postJSON } from '@/infrastructure/fetch-json'
import { useOnlineUsersContext } from '@/features/ide-react/context/online-users-context'
import { useEditorContext } from '@/shared/context/editor-context'
import { useIdeContext } from '@/shared/context/ide-context'
import useSocketListener from '@/features/ide-react/hooks/use-socket-listener'
import useEventListener from '@/shared/hooks/use-event-listener'
import { FileTreeFindResult } from '@/features/ide-react/types/file-tree'
import { Project } from '../../../../../types/project'
import { useModalsContext } from '@/features/ide-react/context/modals-context'
import { useTranslation } from 'react-i18next'

type DocumentMetadata = {
  labels: string[]
  packages: Record<string, any>
}

type DocumentsMetadata = Record<string, DocumentMetadata>

type MetadataContextValue = {
  metadata: {
    state: {
      documents: DocumentsMetadata
    }
    getAllLabels: () => DocumentMetadata['labels']
    getAllPackages: () => DocumentMetadata['packages']
  }
}

type DocMetadataResponse = { docId: string; meta: DocumentMetadata }

const MetadataContext = createContext<MetadataContextValue | undefined>(
  undefined
)

export const MetadataProvider: FC = ({ children }) => {
  const { t } = useTranslation()
  const ide = useIdeContext()
  const { eventEmitter, projectId } = useIdeReactContext()
  const { socket } = useConnectionContext()
  const { onlineUsersCount } = useOnlineUsersContext()
  const { permissionsLevel } = useEditorContext()
  const { currentDocument } = useEditorManagerContext()
  const { showGenericMessageModal } = useModalsContext()

  const [documents, setDocuments] = useState<DocumentsMetadata>({})

  const debouncerRef = useRef<Map<string, number>>(new Map()) // DocId => Timeout

  useEffect(() => {
    const handleEntityDeleted = (entity: FileTreeFindResult) => {
      if (entity.type === 'doc') {
        setDocuments(documents => {
          return _.omit(documents, entity.entity._id)
        })
      }
    }

    eventEmitter.on('entity:deleted', handleEntityDeleted)

    return () => {
      eventEmitter.off('entity:deleted', handleEntityDeleted)
    }
  }, [eventEmitter])

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('project:metadata', { detail: documents })
    )
  }, [documents])

  const onBroadcastDocMeta = useCallback((data: DocMetadataResponse) => {
    const { docId, meta } = data
    if (docId != null && meta != null) {
      setDocuments(documents => ({ ...documents, [docId]: meta }))
    }
  }, [])

  const getAllLabels = useCallback(
    () => _.flattenDeep(Object.values(documents).map(meta => meta.labels)),
    [documents]
  )

  const getAllPackages = useCallback(() => {
    const packageCommandMapping: Record<string, any> = {}
    for (const meta of Object.values(documents)) {
      for (const [packageName, commandSnippets] of Object.entries(
        meta.packages
      )) {
        packageCommandMapping[packageName] = commandSnippets
      }
    }
    return packageCommandMapping
  }, [documents])

  const loadProjectMetaFromServer = useCallback(() => {
    getJSON(`/project/${projectId}/metadata`).then(
      (response: { projectMeta: DocumentsMetadata }) => {
        const { projectMeta } = response
        if (projectMeta) {
          setDocuments(projectMeta)
        }
      }
    )
  }, [projectId])

  const loadDocMetaFromServer = useCallback(
    (docId: string) => {
      // Don't broadcast metadata when there are no other users in the
      // project.
      const broadcast = onlineUsersCount > 0
      postJSON(`/project/${projectId}/doc/${docId}/metadata`, {
        body: {
          broadcast,
        },
      }).then((response: DocMetadataResponse) => {
        if (!broadcast && response) {
          // handle the POST response like a broadcast event when there are no
          // other users in the project.
          onBroadcastDocMeta(response)
        }
      })
    },
    [onBroadcastDocMeta, onlineUsersCount, projectId]
  )

  const scheduleLoadDocMetaFromServer = useCallback(
    (docId: string) => {
      if (permissionsLevel === 'readOnly') {
        // The POST request is blocked for users without write permission.
        // The user will not be able to consume the metadata for edits anyway.
        return
      }
      // Debounce loading labels with a timeout
      const existingTimeout = debouncerRef.current.get(docId)

      if (existingTimeout != null) {
        window.clearTimeout(existingTimeout)
        debouncerRef.current.delete(docId)
      }

      debouncerRef.current.set(
        docId,
        window.setTimeout(() => {
          // TODO: wait for the document to be saved?
          loadDocMetaFromServer(docId)
          debouncerRef.current.delete(docId)
        }, 2000)
      )
    },
    [loadDocMetaFromServer, permissionsLevel]
  )

  const handleBroadcastDocMeta = useCallback(
    (data: DocMetadataResponse) => {
      onBroadcastDocMeta(data)
    },
    [onBroadcastDocMeta]
  )

  useSocketListener(socket, 'broadcastDocMeta', handleBroadcastDocMeta)

  const handleMetadataOutdated = useCallback(() => {
    if (currentDocument) {
      scheduleLoadDocMetaFromServer(currentDocument.doc_id)
    }
  }, [currentDocument, scheduleLoadDocMetaFromServer])

  useEventListener('editor:metadata-outdated', handleMetadataOutdated)

  useEffect(() => {
    const handleProjectJoined = ({ project }: { project: Project }) => {
      if (project.deletedByExternalDataSource) {
        showGenericMessageModal(
          t('project_renamed_or_deleted'),
          t('project_renamed_or_deleted_detail')
        )
      }
      window.setTimeout(() => {
        if (permissionsLevel !== 'readOnly') {
          loadProjectMetaFromServer()
        }
      }, 200)
    }

    eventEmitter.once('project:joined', handleProjectJoined)

    return () => {
      eventEmitter.off('project:joined', handleProjectJoined)
    }
  }, [
    eventEmitter,
    loadProjectMetaFromServer,
    permissionsLevel,
    showGenericMessageModal,
    t,
  ])

  const value = useMemo<MetadataContextValue>(
    () => ({
      metadata: {
        state: { documents },
        getAllLabels,
        getAllPackages,
      },
    }),
    [documents, getAllLabels, getAllPackages]
  )

  // Expose metadataManager via ide object because useCodeMirrorScope relies on
  // it, for now
  ide.metadataManager = value

  return (
    <MetadataContext.Provider value={value}>
      {children}
    </MetadataContext.Provider>
  )
}

export function useMetadataContext(): MetadataContextValue {
  const context = useContext(MetadataContext)

  if (!context) {
    throw new Error(
      'useMetadataContext is only available inside MetadataProvider'
    )
  }

  return context
}
