import React, { FC, useEffect, useState } from 'react'
import { User, UserId } from '../../../types/user'
import { Project } from '../../../types/project'
import {
  mockBuildFile,
  mockCompile,
  mockCompileError,
} from '../fixtures/compile'
import useFetchMock from '../hooks/use-fetch-mock'
import { useMeta } from '../hooks/use-meta'
import SocketIOShim, { SocketIOMock } from '@/ide/connection/SocketIoShim'
import { IdeContext } from '@/shared/context/ide-context'
import { IdeReactContext } from '@/features/ide-react/context/ide-react-context'
import { IdeEventEmitter } from '@/features/ide-react/create-ide-event-emitter'
import { ReactScopeValueStore } from '@/features/ide-react/scope-value-store/react-scope-value-store'
import { ReactScopeEventEmitter } from '@/features/ide-react/scope-event-emitter/react-scope-event-emitter'
import { ConnectionContext } from '@/features/ide-react/context/connection-context'
import { Socket } from '@/features/ide-react/connection/types/socket'
import { ConnectionState } from '@/features/ide-react/connection/types/connection-state'
import { ReactContextRoot } from '@/features/ide-react/context/react-context-root'

const scopeWatchers: [string, (value: any) => void][] = []

export const user: User = {
  id: 'story-user' as UserId,
  email: 'story-user@example.com',
  allowedFreeTrial: true,
  features: { dropbox: true, symbolPalette: true },
}

const project: Project = {
  _id: '63e21c07946dd8c76505f85a',
  name: 'A Project',
  features: { mendeley: true, zotero: true, referencesSearch: true },
  tokens: {},
  owner: {
    _id: 'a-user',
    email: 'stories@overleaf.com',
  },
  members: [],
  invites: [],
  rootDocId: '5e74f1a7ce17ae0041dfd056',
  rootFolder: [
    {
      _id: 'root-folder-id',
      name: 'rootFolder',
      docs: [
        { _id: 'test-file-id', name: 'testfile.tex' },
        { _id: 'test-bib-file-id', name: 'testsources.bib' },
      ],
      fileRefs: [{ _id: 'test-image-id', name: 'frog.jpg', hash: '42' }],
      folders: [],
    },
  ],
}

const socket = new SocketIOShim.SocketShimNoop(
  new SocketIOMock()
) as unknown as Socket

const initializeMetaTags = () => {
  // window.metaAttributesCache is reset in preview.tsx
  window.metaAttributesCache.set('ol-user', user)
  window.metaAttributesCache.set('ol-project_id', project._id)
  window.metaAttributesCache.set(
    'ol-gitBridgePublicBaseUrl',
    'https://git.stories.com'
  )
}

type ScopeDecoratorOptions = {
  mockCompileOnLoad: boolean
  providers?: Record<string, any>
}

export const ScopeDecorator = (
  Story: any,
  opts: ScopeDecoratorOptions = { mockCompileOnLoad: true },
  meta: Record<string, any> = {}
) => {
  initializeMetaTags()

  // mock compile on load
  useFetchMock(fetchMock => {
    if (opts.mockCompileOnLoad) {
      mockCompile(fetchMock)
      mockCompileError(fetchMock)
      mockBuildFile(fetchMock)
    }
  })

  // clear scopeWatchers on unmount
  useEffect(() => {
    return () => {
      scopeWatchers.length = 0
    }
  }, [])

  // set values on window.metaAttributesCache (created in initialize, above)
  useMeta(meta)

  return (
    <ReactContextRoot
      providers={{
        ConnectionProvider,
        IdeReactProvider,
        ...opts.providers,
      }}
    >
      <Story />
    </ReactContextRoot>
  )
}

const ConnectionProvider: FC<React.PropsWithChildren> = ({ children }) => {
  const [value] = useState(() => {
    const connectionState: ConnectionState = {
      readyState: WebSocket.OPEN,
      forceDisconnected: false,
      inactiveDisconnect: false,
      reconnectAt: null,
      forcedDisconnectDelay: 0,
      lastConnectionAttempt: 0,
      error: '',
    }
    return {
      socket,
      connectionState,
      isConnected: true,
      isStillReconnecting: false,
      secondsUntilReconnect: () => 0,
      tryReconnectNow: () => {},
      registerUserActivity: () => {},
      closeConnection: () => {},
      getSocketDebuggingInfo: () => ({
        client_id: 'fakeClientId',
        transport: 'fakeTransport',
        publicId: 'fakePublicId',
        lastUserActivity: 0,
        connectionState,
        externalHeartbeat: {
          currentStart: 0,
          lastSuccess: 0,
          lastLatency: 0,
        },
      }),
    }
  })

  return (
    <ConnectionContext.Provider value={value}>
      {children}
    </ConnectionContext.Provider>
  )
}

const IdeReactProvider: FC<React.PropsWithChildren> = ({ children }) => {
  const projectId = 'project-123'
  const [startedFreeTrial, setStartedFreeTrial] = useState(false)

  const [ideReactContextValue] = useState(() => ({
    projectId,
    eventEmitter: new IdeEventEmitter(),
    startedFreeTrial,
    setStartedFreeTrial,
    reportError: () => {},
    projectJoined: true,
    permissionsLevel: 'owner' as const,
    setPermissionsLevel: () => {},
    setOutOfSync: () => {},
  }))

  const [ideContextValue] = useState(() => {
    const scopeEventEmitter = new ReactScopeEventEmitter(new IdeEventEmitter())
    const unstableStore = new ReactScopeValueStore()

    window.overleaf = {
      ...window.overleaf,
      unstable: {
        ...window.overleaf?.unstable,
        store: unstableStore,
      },
    }

    return {
      socket,
      scopeEventEmitter,
      unstableStore,
    }
  })

  return (
    <IdeReactContext.Provider value={ideReactContextValue}>
      <IdeContext.Provider value={ideContextValue}>
        {children}
      </IdeContext.Provider>
    </IdeReactContext.Provider>
  )
}
