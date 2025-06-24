// Disable prop type checks for test harnesses
/* eslint-disable react/prop-types */
import { merge } from 'lodash'
import { SocketIOMock } from '@/ide/connection/SocketIoShim'
import { IdeContext } from '@/shared/context/ide-context'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createReactScopeValueStore,
  IdeReactContext,
} from '@/features/ide-react/context/ide-react-context'
import { IdeEventEmitter } from '@/features/ide-react/create-ide-event-emitter'
import { ReactScopeEventEmitter } from '@/features/ide-react/scope-event-emitter/react-scope-event-emitter'
import { ConnectionContext } from '@/features/ide-react/context/connection-context'
import { ReactContextRoot } from '@/features/ide-react/context/react-context-root'
import useEventListener from '@/shared/hooks/use-event-listener'
import useDetachLayout from '@/shared/hooks/use-detach-layout'
import { LayoutContext } from '@/shared/context/layout-context'

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
  mathPreview: true,
}

/**
 * @typedef {import('@/shared/context/layout-context').LayoutContextValue} LayoutContextValue
 * @type Partial<LayoutContextValue>
 */
const layoutContextDefault = {
  view: 'editor',
  openFile: null,
  chatIsOpen: true, // false in the application, true in tests
  reviewPanelOpen: false,
  miniReviewPanelVisible: false,
  leftMenuShown: false,
  projectSearchIsOpen: false,
  pdfLayout: 'sideBySide',
  loadingStyleSheet: false,
}

export function EditorProviders({
  user = { id: USER_ID, email: USER_EMAIL },
  projectId = PROJECT_ID,
  projectOwner = {
    _id: '124abd',
    email: 'owner@example.com',
  },
  rootDocId = '_root_doc_id',
  imageName = 'texlive-full:2024.1',
  compiler = 'pdflatex',
  socket = new SocketIOMock(),
  isRestrictedTokenMember = false,
  scope: defaultScope = {},
  features = {
    referencesSearch: true,
  },
  projectFeatures = features,
  permissionsLevel = 'owner',
  children,
  rootFolder = [
    {
      _id: 'root-folder-id',
      name: 'rootFolder',
      docs: [
        {
          _id: '_root_doc_id',
          name: 'main.tex',
        },
      ],
      folders: [],
      fileRefs: [],
    },
  ],
  /** @type {Partial<LayoutContext>} */
  layoutContext = layoutContextDefault,
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

  window.metaAttributesCache.set('ol-capabilities', ['chat', 'dropbox'])

  const scope = merge(
    {
      user,
      editor: {
        sharejs_doc: {
          doc_id: 'test-doc',
          getSnapshot: () => 'some doc content',
          hasBufferedOps: () => false,
          on: () => {},
          off: () => {},
          leaveAndCleanUpPromise: async () => {},
        },
      },
      project: {
        _id: projectId,
        name: PROJECT_NAME,
        owner: projectOwner,
        features: projectFeatures,
        rootDocId,
        rootFolder,
        imageName,
        compiler,
      },
      permissionsLevel,
    },
    defaultScope
  )

  // Add details for useUserContext
  window.metaAttributesCache.set('ol-user', { ...user, features })
  window.metaAttributesCache.set('ol-project_id', projectId)

  return (
    <ReactContextRoot
      providers={{
        ConnectionProvider: makeConnectionProvider(socket),
        IdeReactProvider: makeIdeReactProvider(scope, socket),
        LayoutProvider: makeLayoutProvider(layoutContext),
        ...providers,
      }}
    >
      {children}
    </ReactContextRoot>
  )
}

const makeConnectionProvider = socket => {
  const ConnectionProvider = ({ children }) => {
    const [value] = useState(() => ({
      socket,
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
  return ConnectionProvider
}

const makeIdeReactProvider = (scope, socket) => {
  const IdeReactProvider = ({ children }) => {
    const [startedFreeTrial, setStartedFreeTrial] = useState(false)

    const [ideReactContextValue] = useState(() => ({
      projectId: PROJECT_ID,
      eventEmitter: new IdeEventEmitter(),
      startedFreeTrial,
      setStartedFreeTrial,
      reportError: () => {},
      projectJoined: true,
    }))

    const [ideContextValue] = useState(() => {
      const scopeStore = createReactScopeValueStore(PROJECT_ID)
      for (const [key, value] of Object.entries(scope)) {
        // TODO: path for nested entries
        scopeStore.set(key, value)
      }
      scopeStore.set('editor.sharejs_doc', scope.editor.sharejs_doc)
      const scopeEventEmitter = new ReactScopeEventEmitter(
        new IdeEventEmitter()
      )

      return {
        socket,
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
  return IdeReactProvider
}

const makeLayoutProvider = layoutContextOverrides => {
  const layout = {
    ...layoutContextDefault,
    ...layoutContextOverrides,
  }
  const LayoutProvider = ({ children }) => {
    const [view, setView] = useState(layout.view)
    const [openFile, setOpenFile] = useState(layout.openFile)
    const [chatIsOpen, setChatIsOpen] = useState(layout.chatIsOpen)
    const [reviewPanelOpen, setReviewPanelOpen] = useState(
      layout.reviewPanelOpen
    )
    const [miniReviewPanelVisible, setMiniReviewPanelVisible] = useState(
      layout.miniReviewPanelVisible
    )
    const [leftMenuShown, setLeftMenuShown] = useState(layout.leftMenuShown)
    const [projectSearchIsOpen, setProjectSearchIsOpen] = useState(
      layout.projectSearchIsOpen
    )
    const [pdfLayout, setPdfLayout] = useState(layout.pdfLayout)
    const [loadingStyleSheet, setLoadingStyleSheet] = useState(
      layout.loadingStyleSheet
    )

    useEventListener(
      'ui.toggle-review-panel',
      useCallback(() => {
        setReviewPanelOpen(open => !open)
      }, [setReviewPanelOpen])
    )
    const changeLayout = useCallback(
      (newLayout, newView = 'editor') => {
        setPdfLayout(newLayout)
        setView(newLayout === 'sideBySide' ? 'editor' : newView)
      },
      [setPdfLayout, setView]
    )
    const {
      reattach,
      detach,
      isLinked: detachIsLinked,
      role: detachRole,
    } = useDetachLayout()
    const pdfPreviewOpen =
      pdfLayout === 'sideBySide' || view === 'pdf' || detachRole === 'detacher'
    const value = useMemo(
      () => ({
        reattach,
        detach,
        detachIsLinked,
        detachRole,
        changeLayout,
        chatIsOpen,
        leftMenuShown,
        openFile,
        pdfLayout,
        pdfPreviewOpen,
        projectSearchIsOpen,
        setProjectSearchIsOpen,
        reviewPanelOpen,
        miniReviewPanelVisible,
        loadingStyleSheet,
        setChatIsOpen,
        setLeftMenuShown,
        setOpenFile,
        setPdfLayout,
        setReviewPanelOpen,
        setMiniReviewPanelVisible,
        setLoadingStyleSheet,
        setView,
        view,
      }),
      [
        reattach,
        detach,
        detachIsLinked,
        detachRole,
        changeLayout,
        chatIsOpen,
        leftMenuShown,
        openFile,
        pdfLayout,
        pdfPreviewOpen,
        projectSearchIsOpen,
        setProjectSearchIsOpen,
        reviewPanelOpen,
        miniReviewPanelVisible,
        loadingStyleSheet,
        setChatIsOpen,
        setLeftMenuShown,
        setOpenFile,
        setPdfLayout,
        setReviewPanelOpen,
        setMiniReviewPanelVisible,
        setLoadingStyleSheet,
        setView,
        view,
      ]
    )

    return (
      <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>
    )
  }
  return LayoutProvider
}
