// Disable prop type checks for test harnesses
/* eslint-disable react/prop-types */
import sinon from 'sinon'
import { get, merge } from 'lodash'
import { SplitTestProvider } from '@/shared/context/split-test-context'
import { UserProvider } from '@/shared/context/user-context'
import { ProjectProvider } from '@/shared/context/project-context'
import { FileTreeDataProvider } from '@/shared/context/file-tree-data-context'
import { EditorProvider } from '@/shared/context/editor-context'
import { DetachProvider } from '@/shared/context/detach-context'
import { LayoutProvider } from '@/shared/context/layout-context'
import { LocalCompileProvider } from '@/shared/context/local-compile-context'
import { DetachCompileProvider } from '@/shared/context/detach-compile-context'
import { ProjectSettingsProvider } from '@/features/editor-left-menu/context/project-settings-context'
import { FileTreePathProvider } from '@/features/file-tree/contexts/file-tree-path'
import { UserSettingsProvider } from '@/shared/context/user-settings-context'
import { OutlineProvider } from '@/features/ide-react/context/outline-context'
import { SocketIOMock } from '@/ide/connection/SocketIoShim'
import { IdeContext } from '@/shared/context/ide-context'
import React, { useEffect, useState } from 'react'
import {
  createReactScopeValueStore,
  IdeReactContext,
} from '@/features/ide-react/context/ide-react-context'
import { IdeEventEmitter } from '@/features/ide-react/create-ide-event-emitter'
import { ReactScopeEventEmitter } from '@/features/ide-react/scope-event-emitter/react-scope-event-emitter'
import { ConnectionContext } from '@/features/ide-react/context/connection-context'
import { EventLog } from '@/features/ide-react/editor/event-log'
import { ChatProvider } from '@/features/chat/context/chat-context'
import { EditorManagerProvider } from '@/features/ide-react/context/editor-manager-context'
import { FileTreeOpenProvider } from '@/features/ide-react/context/file-tree-open-context'
import { MetadataProvider } from '@/features/ide-react/context/metadata-context'
import { ModalsContextProvider } from '@/features/ide-react/context/modals-context'
import { OnlineUsersProvider } from '@/features/ide-react/context/online-users-context'
import { PermissionsProvider } from '@/features/ide-react/context/permissions-context'
import { ReferencesProvider } from '@/features/ide-react/context/references-context'

// these constants can be imported in tests instead of
// using magic strings
export const PROJECT_ID = 'project123'
export const PROJECT_NAME = 'project-name'
export const USER_ID = '123abd'
export const USER_EMAIL = 'testuser@example.com'

const defaultUserSettings = {
  pdfViewer: 'pdfjs',
  fontSize: 12,
  fontFamily: 'monaco',
  lineHeight: 'normal',
  editorTheme: 'textmate',
  overallTheme: '',
  mode: 'default',
  autoComplete: true,
  autoPairDelimiters: true,
  trackChanges: true,
  syntaxValidation: false,
}

export function EditorProviders({
  user = { id: USER_ID, email: USER_EMAIL },
  projectId = PROJECT_ID,
  projectOwner = {
    _id: '124abd',
    email: 'owner@example.com',
  },
  rootDocId = '_root_doc_id',
  socket = new SocketIOMock(),
  isRestrictedTokenMember = false,
  clsiServerId = '1234',
  scope = {},
  features = {
    referencesSearch: true,
  },
  permissionsLevel = 'owner',
  children,
  rootFolder = [
    {
      _id: 'root-folder-id',
      name: 'rootFolder',
      docs: [],
      folders: [],
      fileRefs: [],
    },
  ],
  ui = { view: 'editor', pdfLayout: 'sideBySide', chatOpen: true },
  fileTreeManager = {
    findEntityById: () => null,
    findEntityByPath: () => null,
    getEntityPath: () => '',
    getRootDocDirname: () => '',
    getPreviewByPath: path => ({ url: path, extension: 'png' }),
  },
  editorManager = {
    getCurrentDocId: () => 'foo',
    getCurrentDocValue: () => {},
    openDoc: sinon.stub(),
  },
  userSettings = {},
  providers = {},
}) {
  window.metaAttributesCache.set(
    'ol-gitBridgePublicBaseUrl',
    'https://git.overleaf.test'
  )
  window.metaAttributesCache.set(
    'ol-isRestrictedTokenMember',
    isRestrictedTokenMember
  )
  window.metaAttributesCache.set(
    'ol-userSettings',
    merge({}, defaultUserSettings, userSettings)
  )

  const $scope = merge(
    {
      user,
      editor: {
        sharejs_doc: {
          doc_id: 'test-doc',
          getSnapshot: () => 'some doc content',
        },
      },
      project: {
        _id: projectId,
        name: PROJECT_NAME,
        owner: projectOwner,
        features,
        rootDoc_id: rootDocId,
        rootFolder,
      },
      ui,
      $watch: (path, callback) => {
        callback(get($scope, path))
        return () => null
      },
      $on: sinon.stub(),
      $applyAsync: sinon.stub(),
      permissionsLevel,
    },
    scope
  )

  window._ide = {
    $scope,
    socket,
    clsiServerId,
    editorManager,
    fileTreeManager,
  }

  // Add details for useUserContext
  window.metaAttributesCache.set('ol-user', { ...user, features })
  window.metaAttributesCache.set('ol-project_id', projectId)
  const Providers = {
    ChatProvider,
    ConnectionProvider,
    DetachCompileProvider,
    DetachProvider,
    EditorProvider,
    EditorManagerProvider,
    FileTreeDataProvider,
    FileTreeOpenProvider,
    FileTreePathProvider,
    IdeReactProvider,
    LayoutProvider,
    LocalCompileProvider,
    MetadataProvider,
    ModalsContextProvider,
    OnlineUsersProvider,
    OutlineProvider,
    PermissionsProvider,
    ProjectProvider,
    ProjectSettingsProvider,
    ReferencesProvider,
    SplitTestProvider,
    UserProvider,
    UserSettingsProvider,
    ...providers,
  }

  return (
    <Providers.SplitTestProvider>
      <Providers.ModalsContextProvider>
        <Providers.ConnectionProvider>
          <Providers.IdeReactProvider>
            <Providers.UserProvider>
              <Providers.UserSettingsProvider>
                <Providers.ProjectProvider>
                  <Providers.FileTreeDataProvider>
                    <Providers.FileTreePathProvider>
                      <Providers.ReferencesProvider>
                        <Providers.DetachProvider>
                          <Providers.EditorProvider>
                            <Providers.PermissionsProvider>
                              <Providers.ProjectSettingsProvider>
                                <Providers.LayoutProvider>
                                  <Providers.EditorManagerProvider>
                                    <Providers.LocalCompileProvider>
                                      <Providers.DetachCompileProvider>
                                        <Providers.ChatProvider>
                                          <Providers.FileTreeOpenProvider>
                                            <Providers.OnlineUsersProvider>
                                              <Providers.MetadataProvider>
                                                <Providers.OutlineProvider>
                                                  {children}
                                                </Providers.OutlineProvider>
                                              </Providers.MetadataProvider>
                                            </Providers.OnlineUsersProvider>
                                          </Providers.FileTreeOpenProvider>
                                        </Providers.ChatProvider>
                                      </Providers.DetachCompileProvider>
                                    </Providers.LocalCompileProvider>
                                  </Providers.EditorManagerProvider>
                                </Providers.LayoutProvider>
                              </Providers.ProjectSettingsProvider>
                            </Providers.PermissionsProvider>
                          </Providers.EditorProvider>
                        </Providers.DetachProvider>
                      </Providers.ReferencesProvider>
                    </Providers.FileTreePathProvider>
                  </Providers.FileTreeDataProvider>
                </Providers.ProjectProvider>
              </Providers.UserSettingsProvider>
            </Providers.UserProvider>
          </Providers.IdeReactProvider>
        </Providers.ConnectionProvider>
      </Providers.ModalsContextProvider>
    </Providers.SplitTestProvider>
  )
}

const ConnectionProvider = ({ children }) => {
  const [value] = useState(() => ({
    socket: window._ide.socket,
    connectionState: {
      readyState: WebSocket.OPEN,
      forceDisconnected: false,
      inactiveDisconnect: false,
      reconnectAt: null,
      forcedDisconnectDelay: 0,
      lastConnectionAttempt: 0,
      error: '',
    },
    isConnected: true,
    isStillReconnecting: false,
    secondsUntilReconnect: () => 0,
    tryReconnectNow: () => {},
    registerUserActivity: () => {},
    disconnect: () => {},
  }))

  return (
    <ConnectionContext.Provider value={value}>
      {children}
    </ConnectionContext.Provider>
  )
}

const IdeReactProvider = ({ children }) => {
  const [startedFreeTrial, setStartedFreeTrial] = useState(false)

  const [ideReactContextValue] = useState(() => ({
    projectId: PROJECT_ID,
    eventEmitter: new IdeEventEmitter(),
    eventLog: new EventLog(),
    startedFreeTrial,
    setStartedFreeTrial,
    reportError: () => {},
    projectJoined: true,
  }))

  const [ideContextValue] = useState(() => {
    const ide = window._ide

    const scopeStore = createReactScopeValueStore(PROJECT_ID)
    for (const [key, value] of Object.entries(ide.$scope)) {
      // TODO: path for nested entries
      scopeStore.set(key, value)
    }
    scopeStore.set('editor.sharejs_doc', ide.$scope.editor.sharejs_doc)
    scopeStore.set('ui.chatOpen', ide.$scope.ui.chatOpen)
    const scopeEventEmitter = new ReactScopeEventEmitter(new IdeEventEmitter())

    return {
      ...ide,
      scopeStore,
      scopeEventEmitter,
    }
  })

  useEffect(() => {
    window.overleaf = {
      ...window.overleaf,
      unstable: {
        ...window.overleaf?.unstable,
        store: ideContextValue.scopeStore,
      },
    }
  }, [ideContextValue.scopeStore])

  return (
    <IdeReactContext.Provider value={ideReactContextValue}>
      <IdeContext.Provider value={ideContextValue}>
        {children}
      </IdeContext.Provider>
    </IdeReactContext.Provider>
  )
}
