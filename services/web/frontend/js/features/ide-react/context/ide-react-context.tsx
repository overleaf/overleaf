import React, {
  createContext,
  useContext,
  useState,
  FC,
  useMemo,
  useEffect,
  useCallback,
} from 'react'
import { ReactScopeValueStore } from '@/features/ide-react/scope-value-store/react-scope-value-store'
import populateLayoutScope from '@/features/ide-react/scope-adapters/layout-context-adapter'
import populateReviewPanelScope from '@/features/ide-react/scope-adapters/review-panel-context-adapter'
import { IdeProvider } from '@/shared/context/ide-context'
import {
  createIdeEventEmitter,
  IdeEventEmitter,
} from '@/features/ide-react/create-ide-event-emitter'
import { JoinProjectPayload } from '@/features/ide-react/connection/join-project-payload'
import { useConnectionContext } from '@/features/ide-react/context/connection-context'
import { getMockIde } from '@/shared/context/mock/mock-ide'
import { populateEditorScope } from '@/features/ide-react/scope-adapters/editor-manager-context-adapter'
import { postJSON } from '@/infrastructure/fetch-json'
import { populateOnlineUsersScope } from '@/features/ide-react/context/online-users-context'
import { ReactScopeEventEmitter } from '@/features/ide-react/scope-event-emitter/react-scope-event-emitter'
import getMeta from '@/utils/meta'

const LOADED_AT = new Date()

type IdeReactContextValue = {
  projectId: string
  eventEmitter: IdeEventEmitter
  startedFreeTrial: boolean
  setStartedFreeTrial: React.Dispatch<
    React.SetStateAction<IdeReactContextValue['startedFreeTrial']>
  >
  reportError: (error: any, meta?: Record<string, any>) => void
  projectJoined: boolean
}

export const IdeReactContext = createContext<IdeReactContextValue | undefined>(
  undefined
)

function populateIdeReactScope(store: ReactScopeValueStore) {
  store.set('settings', {})
  store.set('sync_tex_error', false)
}

function populateProjectScope(store: ReactScopeValueStore) {
  store.allowNonExistentPath('project', true)
  store.set('permissionsLevel', 'readOnly')
  store.set('permissions', {
    read: true,
    write: false,
    admin: false,
    comment: true,
  })
}

function populatePdfScope(store: ReactScopeValueStore) {
  store.allowNonExistentPath('pdf', true)
}

export function createReactScopeValueStore(projectId: string) {
  const scopeStore = new ReactScopeValueStore()

  // Populate the scope value store with default values that will be used by
  // nested contexts that refer to scope values. The ideal would be to leave
  // initialization of store values up to the nested context, which would keep
  // initialization code together with the context and would only populate
  // necessary values in the store, but this is simpler for now
  populateIdeReactScope(scopeStore)
  populateEditorScope(scopeStore, projectId)
  populateLayoutScope(scopeStore)
  populateProjectScope(scopeStore)
  populatePdfScope(scopeStore)
  populateOnlineUsersScope(scopeStore)
  populateReviewPanelScope(scopeStore)

  scopeStore.allowNonExistentPath('hasLintingError')
  scopeStore.allowNonExistentPath('loadingThreads')

  return scopeStore
}

export const IdeReactProvider: FC = ({ children }) => {
  const projectId = getMeta('ol-project_id')
  const [scopeStore] = useState(() => createReactScopeValueStore(projectId))
  const [eventEmitter] = useState(createIdeEventEmitter)
  const [scopeEventEmitter] = useState(
    () => new ReactScopeEventEmitter(eventEmitter)
  )
  const [startedFreeTrial, setStartedFreeTrial] = useState(false)
  const release = getMeta('ol-ExposedSettings')?.sentryRelease ?? null

  // Set to true only after project:joined has fired and all its listeners have
  // been called
  const [projectJoined, setProjectJoined] = useState(false)

  const { socket, getSocketDebuggingInfo } = useConnectionContext()

  const reportError = useCallback(
    (error: any, meta?: Record<string, any>) => {
      const metadata = {
        ...meta,
        user_id: getMeta('ol-user_id'),
        project_id: projectId,
        client_now: new Date(),
        performance_now: performance.now(),
        release,
        client_load: LOADED_AT,
        spellCheckLanguage: scopeStore.get('project.spellCheckLanguage'),
        ...getSocketDebuggingInfo(),
      }

      const errorObj: Record<string, any> = {}
      if (typeof error === 'object') {
        for (const key of Object.getOwnPropertyNames(error)) {
          errorObj[key] = error[key]
        }
      } else if (typeof error === 'string') {
        errorObj.message = error
      }
      return postJSON('/error/client', {
        body: {
          error: errorObj,
          meta: metadata,
        },
      })
    },
    [release, projectId, getSocketDebuggingInfo, scopeStore]
  )

  // Populate scope values when joining project, then fire project:joined event
  useEffect(() => {
    function handleJoinProjectResponse({
      project,
      permissionsLevel,
    }: JoinProjectPayload) {
      scopeStore.set('project', { rootDoc_id: null, ...project })
      scopeStore.set('permissionsLevel', permissionsLevel)
      // Make watchers update immediately
      scopeStore.flushUpdates()
      eventEmitter.emit('project:joined', { project, permissionsLevel })
      setProjectJoined(true)
    }

    function handleMainBibliographyDocUpdated(payload: string) {
      scopeStore.set('project.mainBibliographyDoc_id', payload)
    }

    socket.on('joinProjectResponse', handleJoinProjectResponse)
    socket.on('mainBibliographyDocUpdated', handleMainBibliographyDocUpdated)

    return () => {
      socket.removeListener('joinProjectResponse', handleJoinProjectResponse)
      socket.removeListener(
        'mainBibliographyDocUpdated',
        handleMainBibliographyDocUpdated
      )
    }
  }, [socket, eventEmitter, scopeStore])

  const ide = useMemo(() => {
    return {
      ...getMockIde(),
      socket,
      reportError,
    }
  }, [socket, reportError])

  const value = useMemo(
    () => ({
      eventEmitter,
      startedFreeTrial,
      setStartedFreeTrial,
      projectId,
      reportError,
      projectJoined,
    }),
    [eventEmitter, projectId, projectJoined, reportError, startedFreeTrial]
  )

  return (
    <IdeReactContext.Provider value={value}>
      <IdeProvider
        ide={ide}
        scopeStore={scopeStore}
        scopeEventEmitter={scopeEventEmitter}
      >
        {children}
      </IdeProvider>
    </IdeReactContext.Provider>
  )
}

export function useIdeReactContext(): IdeReactContextValue {
  const context = useContext(IdeReactContext)

  if (!context) {
    throw new Error(
      'useIdeReactContext is only available inside IdeReactProvider'
    )
  }

  return context
}
