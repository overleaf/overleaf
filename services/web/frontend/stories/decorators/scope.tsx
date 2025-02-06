import React, { FC, useEffect, useState } from 'react'
import { get } from 'lodash'
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
import {
  IdeReactContext,
  createReactScopeValueStore,
} from '@/features/ide-react/context/ide-react-context'
import { IdeEventEmitter } from '@/features/ide-react/create-ide-event-emitter'
import { ReactScopeEventEmitter } from '@/features/ide-react/scope-event-emitter/react-scope-event-emitter'
import { ConnectionContext } from '@/features/ide-react/context/connection-context'
import { Socket } from '@/features/ide-react/connection/types/socket'
import { ConnectionState } from '@/features/ide-react/connection/types/connection-state'
import { ReactContextRoot } from '@/features/ide-react/context/react-context-root'

const scopeWatchers: [string, (value: any) => void][] = []

const initialize = () => {
  const user: User = {
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
    rootDoc_id: '5e74f1a7ce17ae0041dfd056',
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

  const scope = {
    user,
    project,
    $watch: (key: string, callback: () => void) => {
      scopeWatchers.push([key, callback])
    },
    $applyAsync: (callback: () => void) => {
      window.setTimeout(() => {
        callback()
        for (const [key, watcher] of scopeWatchers) {
          watcher(get(ide.$scope, key))
        }
      }, 0)
    },
    $on: (eventName: string, callback: () => void) => {
      //
    },
    $broadcast: () => {},
    ui: {
      chatOpen: true,
      pdfLayout: 'flat',
    },
    settings: {
      pdfViewer: 'js',
      syntaxValidation: true,
    },
    editor: {
      richText: false,
      sharejs_doc: {
        doc_id: 'test-doc',
        getSnapshot: () => 'some doc content',
      },
      open_doc_name: 'testfile.tex',
    },
    hasLintingError: false,
    permissionsLevel: 'owner',
  }

  const ide = {
    $scope: scope,
    socket: new SocketIOShim.SocketShimNoop(
      new SocketIOMock()
    ) as unknown as Socket,
  }

  // window.metaAttributesCache is reset in preview.tsx
  window.metaAttributesCache.set('ol-user', user)
  window.metaAttributesCache.set('ol-project_id', project._id)
  window.metaAttributesCache.set(
    'ol-gitBridgePublicBaseUrl',
    'https://git.stories.com'
  )

  window._ide = ide
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
  initialize()

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

const ConnectionProvider: FC = ({ children }) => {
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
      socket: window._ide.socket as Socket,
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

const IdeReactProvider: FC = ({ children }) => {
  const projectId = 'project-123'
  const [startedFreeTrial, setStartedFreeTrial] = useState(false)

  const [ideReactContextValue] = useState(() => ({
    projectId,
    eventEmitter: new IdeEventEmitter(),
    startedFreeTrial,
    setStartedFreeTrial,
    reportError: () => {},
    projectJoined: true,
  }))

  const [ideContextValue] = useState(() => {
    const ide = window._ide
    const scopeStore = createReactScopeValueStore(projectId)
    for (const [key, value] of Object.entries(ide.$scope)) {
      scopeStore.set(key, value)
    }
    const scopeEventEmitter = new ReactScopeEventEmitter(new IdeEventEmitter())

    window.overleaf = {
      ...window.overleaf,
      unstable: {
        ...window.overleaf?.unstable,
        store: scopeStore,
      },
    }

    return {
      ...ide,
      scopeStore,
      scopeEventEmitter,
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
