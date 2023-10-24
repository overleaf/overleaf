import {
  createContext,
  useContext,
  useState,
  FC,
  useMemo,
  useEffect,
} from 'react'
import { ReactScopeValueStore } from '@/features/ide-react/scope-value-store/react-scope-value-store'
import { IdeProvider } from '@/shared/context/ide-context'
import {
  createIdeEventEmitter,
  IdeEventEmitter,
} from '@/features/ide-react/create-ide-event-emitter'
import { JoinProjectPayload } from '@/features/ide-react/connection/join-project-payload'
import { useConnectionContext } from '@/features/ide-react/context/connection-context'
import { getMockIde } from '@/shared/context/mock/mock-ide'
import { ReactScopeEventEmitter } from '@/features/ide-react/scope-event-emitter/react-scope-event-emitter'

type IdeReactContextValue = {
  projectId: string
  eventEmitter: IdeEventEmitter
}

const IdeReactContext = createContext<IdeReactContextValue | null>(null)

function populateIdeReactScope(store: ReactScopeValueStore) {
  store.set('sync_tex_error', false)
}

function populateProjectScope(store: ReactScopeValueStore) {
  store.allowNonExistentPath('project', true)
  store.set('permissionsLevel', 'readOnly')
}

function createReactScopeValueStore() {
  const scopeStore = new ReactScopeValueStore()

  // Populate the scope value store with default values that will be used by
  // nested contexts that refer to scope values. The ideal would be to leave
  // initialization of store values up to the nested context, which would keep
  // initialization code together with the context and would only populate
  // necessary values in the store, but this is simpler for now
  populateIdeReactScope(scopeStore)
  populateProjectScope(scopeStore)

  return scopeStore
}

const projectId = window.project_id

export const IdeReactProvider: FC = ({ children }) => {
  const [scopeStore] = useState(createReactScopeValueStore)
  const [eventEmitter] = useState(createIdeEventEmitter)
  const [scopeEventEmitter] = useState(
    () => new ReactScopeEventEmitter(eventEmitter)
  )

  const { socket } = useConnectionContext()

  // Fire project:joined event
  useEffect(() => {
    function handleJoinProjectResponse({
      project,
      permissionsLevel,
    }: JoinProjectPayload) {
      eventEmitter.emit('project:joined', { project, permissionsLevel })
    }

    socket.on('joinProjectResponse', handleJoinProjectResponse)

    return () => {
      socket.removeListener('joinProjectResponse', handleJoinProjectResponse)
    }
  }, [socket, eventEmitter])

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
    }

    socket.on('joinProjectResponse', handleJoinProjectResponse)

    return () => {
      socket.removeListener('joinProjectResponse', handleJoinProjectResponse)
    }
  }, [socket, eventEmitter, scopeStore])

  const ide = useMemo(() => {
    return {
      ...getMockIde(),
      socket,
    }
  }, [socket])

  const value = useMemo(
    () => ({
      eventEmitter,
      projectId,
    }),
    [eventEmitter]
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
