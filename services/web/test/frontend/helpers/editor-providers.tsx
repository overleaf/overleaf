// Disable prop type checks for test harnesses
/* eslint-disable react/prop-types */
import { merge } from 'lodash'
import { SocketIOMock } from '@/ide/connection/SocketIoShim'
import { IdeContext } from '@/shared/context/ide-context'
import React, {
  useCallback,
  useEffect,
  useState,
  useMemo,
  type FC,
  type PropsWithChildren,
} from 'react'
import { IdeReactContext } from '@/features/ide-react/context/ide-react-context'
import { IdeEventEmitter } from '@/features/ide-react/create-ide-event-emitter'
import { ReactScopeValueStore } from '@/features/ide-react/scope-value-store/react-scope-value-store'
import { ReactScopeEventEmitter } from '@/features/ide-react/scope-event-emitter/react-scope-event-emitter'
import { ConnectionContext } from '@/features/ide-react/context/connection-context'
import {
  EditorOpenDocContext,
  type EditorOpenDocContextState,
} from '@/features/ide-react/context/editor-open-doc-context'
import { ProjectContext } from '@/shared/context/project-context'
import { ReactContextRoot } from '@/features/ide-react/context/react-context-root'
import useEventListener from '@/shared/hooks/use-event-listener'
import useDetachLayout from '@/shared/hooks/use-detach-layout'
import useExposedState from '@/shared/hooks/use-exposed-state'
import { ProjectSnapshot } from '@/infrastructure/project-snapshot'
import {
  EditorPropertiesContext,
  EditorPropertiesContextValue,
} from '@/features/ide-react/context/editor-properties-context'
import {
  type IdeLayout,
  type IdeView,
  LayoutContext,
  type LayoutContextValue,
} from '@/shared/context/layout-context'
import type { Socket } from '@/features/ide-react/connection/types/socket'
import type { PermissionsLevel } from '@/features/ide-react/types/permissions'
import type { Folder } from '../../../types/folder'
import type { SocketDebuggingInfo } from '@/features/ide-react/connection/types/connection-state'
import type { DocumentContainer } from '@/features/ide-react/editor/document-container'
import {
  ProjectMetadata,
  ProjectUpdate,
} from '@/shared/context/types/project-metadata'
import { UserId } from '../../../types/user'
import { ProjectCompiler } from '../../../types/project-settings'
import { ReferencesContext } from '@/features/ide-react/context/references-context'
import { useEditorAnalytics } from '@/shared/hooks/use-editor-analytics'

// these constants can be imported in tests instead of
// using magic strings
export const PROJECT_ID = 'project123'
export const PROJECT_NAME = 'project-name'
export const USER_ID = '123abd' as UserId
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

export type EditorProvidersProps = {
  user?: { id: string; email: string; signUpDate?: string }
  projectId?: string
  projectName?: string
  projectOwner?: ProjectMetadata['owner']
  rootDocId?: string
  imageName?: string
  compiler?: ProjectCompiler
  socket?: Socket
  isRestrictedTokenMember?: boolean
  scope?: Record<string, any>
  features?: Record<string, boolean>
  projectFeatures?: Record<string, boolean>
  permissionsLevel?: PermissionsLevel
  children?: React.ReactNode
  rootFolder?: Folder[]
  layoutContext?: Partial<LayoutContextValue>
  userSettings?: Record<string, any>
  providers?: Record<string, React.FC<React.PropsWithChildren<any>>>
}

export const projectDefaults: ProjectMetadata = {
  _id: PROJECT_ID,
  name: PROJECT_NAME,
  owner: {
    _id: '124abd' as UserId,
    email: 'owner@example.com',
    first_name: 'Test',
    last_name: 'Owner',
    privileges: 'owner',
    signUpDate: new Date('2025-07-07').toISOString(),
  },
  features: {
    referencesSearch: true,
    gitBridge: false,
  },
  rootDocId: '_root_doc_id',
  rootFolder: [
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
  imageName: 'texlive-full:2024.1',
  compiler: 'pdflatex' as ProjectCompiler,
  members: [],
  invites: [],
  trackChangesState: {} as Record<UserId | '__guests__', boolean>,
  spellCheckLanguage: 'en',
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
} satisfies Partial<LayoutContextValue>

export function EditorProviders({
  user = {
    id: USER_ID,
    email: USER_EMAIL,
    signUpDate: '2025-10-10T10:10:10Z',
  },
  projectId = projectDefaults._id,
  projectName = projectDefaults.name,
  projectOwner = projectDefaults.owner,
  rootDocId = projectDefaults.rootDocId,
  imageName = projectDefaults.imageName,
  compiler = projectDefaults.compiler,
  socket = new SocketIOMock() as any as Socket,
  isRestrictedTokenMember = false,
  scope: defaultScope = {},
  features = {
    referencesSearch: true,
    gitBridge: false,
  },
  projectFeatures = features,
  permissionsLevel = 'owner',
  children,
  rootFolder = projectDefaults.rootFolder,
  /** @type {Partial<LayoutContext>} */
  layoutContext = layoutContextDefault,
  userSettings = {},
  providers = {},
}: EditorProvidersProps) {
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

  window.metaAttributesCache.set('ol-capabilities', [
    'chat',
    'dropbox',
    'link-sharing',
  ])

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
        } as any as DocumentContainer,
        openDocName: null,
        currentDocumentId: null,
        wantTrackChanges: false,
      },
      permissionsLevel,
    },
    defaultScope
  )

  const project = {
    _id: projectId,
    name: projectName,
    owner: projectOwner,
    features: projectFeatures,
    rootDocId,
    rootFolder,
    imageName,
    compiler,
    members: [],
    invites: [],
    trackChangesState: false,
    spellCheckLanguage: 'en',
  }

  // Add details for useUserContext
  window.metaAttributesCache.set('ol-user', { ...user, features })
  window.metaAttributesCache.set('ol-project_id', projectId)

  return (
    <ReactContextRoot
      providers={{
        ConnectionProvider: makeConnectionProvider(socket),
        IdeReactProvider: makeIdeReactProvider(scope, socket),
        EditorOpenDocProvider: makeEditorOpenDocProvider({
          currentDocumentId: scope.editor.currentDocumentId,
          openDocName: scope.editor.openDocName,
          currentDocument: scope.editor.sharejs_doc,
        }),
        EditorPropertiesProvider: makeEditorPropertiesProvider({
          wantTrackChanges: scope.editor.wantTrackChanges,
        }),
        LayoutProvider: makeLayoutProvider(layoutContext),
        ProjectProvider: makeProjectProvider(project),
        ReferencesProvider: makeReferencesProvider(),
        ...providers,
      }}
    >
      {children}
    </ReactContextRoot>
  )
}

const makeReferencesProvider = () => {
  const ReferencesProvider: FC<PropsWithChildren> = ({ children }) => {
    return (
      <ReferencesContext.Provider
        value={{
          referenceKeys: new Set(),
          indexAllReferences: () => Promise.resolve(),
          searchLocalReferences() {
            return Promise.resolve({
              hits: [],
            })
          },
        }}
      >
        {children}
      </ReferencesContext.Provider>
    )
  }
  return ReferencesProvider
}

const makeConnectionProvider = (socket: Socket) => {
  const ConnectionProvider: FC<PropsWithChildren> = ({ children }) => {
    const [value] = useState(() => ({
      socket,
      connectionState: {
        readyState: WebSocket.OPEN,
        forceDisconnected: false,
        inactiveDisconnect: false,
        reconnectAt: null,
        forcedDisconnectDelay: 0,
        lastConnectionAttempt: 0,
        error: '' as const,
      },
      isConnected: true,
      isStillReconnecting: false,
      secondsUntilReconnect: () => 0,
      tryReconnectNow: () => {},
      registerUserActivity: () => {},
      disconnect: () => {},
      closeConnection: () => {},
      getSocketDebuggingInfo: () => ({}) as SocketDebuggingInfo,
    }))

    return (
      <ConnectionContext.Provider value={value}>
        {children}
      </ConnectionContext.Provider>
    )
  }
  return ConnectionProvider
}

const makeIdeReactProvider = (
  scope: Record<string, unknown>,
  socket: Socket
) => {
  const IdeReactProvider: FC<PropsWithChildren> = ({ children }) => {
    const [startedFreeTrial, setStartedFreeTrial] = useState(false)

    const [ideReactContextValue] = useState(() => ({
      projectId: PROJECT_ID,
      eventEmitter: new IdeEventEmitter(),
      startedFreeTrial,
      setStartedFreeTrial,
      reportError: () => {},
      projectJoined: true,
      permissionsLevel: scope.permissionsLevel as PermissionsLevel,
      setPermissionsLevel: () => {},
      setOutOfSync: () => {},
    }))

    const [ideContextValue] = useState(() => {
      const scopeEventEmitter = new ReactScopeEventEmitter(
        new IdeEventEmitter()
      )
      const unstableStore = new ReactScopeValueStore()

      return {
        socket,
        scopeEventEmitter,
        unstableStore,
      }
    })

    useEffect(() => {
      window.overleaf = {
        ...window.overleaf,
        unstable: {
          ...window.overleaf?.unstable,
          store: ideContextValue.unstableStore,
        },
      }
    }, [ideContextValue.unstableStore])

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

export function makeEditorOpenDocProvider(
  initialValues: EditorOpenDocContextState
) {
  const {
    currentDocumentId: initialCurrentDocumentId,
    openDocName: initialOpenDocName,
    currentDocument: initialCurrentDocument,
  } = initialValues
  const EditorOpenDocProvider: FC<PropsWithChildren> = ({ children }) => {
    const [currentDocumentId, setCurrentDocumentId] = useExposedState(
      initialCurrentDocumentId,
      'editor.open_doc_id'
    )
    const [openDocName, setOpenDocName] = useExposedState(
      initialOpenDocName,
      'editor.open_doc_name'
    )
    const [currentDocument, setCurrentDocument] = useState(
      initialCurrentDocument
    )

    const value = {
      currentDocumentId,
      setCurrentDocumentId,
      openDocName,
      setOpenDocName,
      currentDocument,
      setCurrentDocument,
    }

    return (
      <EditorOpenDocContext.Provider value={value}>
        {children}
      </EditorOpenDocContext.Provider>
    )
  }

  return EditorOpenDocProvider
}

const makeLayoutProvider = (
  layoutContextOverrides?: Partial<LayoutContextValue>
) => {
  const layout = {
    ...layoutContextDefault,
    ...layoutContextOverrides,
  }
  const LayoutProvider: FC<PropsWithChildren> = ({ children }) => {
    const [view, setView] = useState<IdeView | null>(layout.view)
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

    const { sendEvent } = useEditorAnalytics()

    useEventListener(
      'ui.toggle-review-panel',
      useCallback(() => {
        setReviewPanelOpen(open => !open)
      }, [setReviewPanelOpen])
    )
    const changeLayout = useCallback(
      (newLayout: IdeLayout, newView: IdeView = 'editor') => {
        setPdfLayout(newLayout)
        setView(newLayout === 'sideBySide' ? 'editor' : newView)
      },
      [setPdfLayout, setView]
    )

    const restoreView = useCallback(() => {
      setView('editor')
    }, [])

    const {
      reattach,
      detach,
      isLinked: detachIsLinked,
      role: detachRole,
    } = useDetachLayout()

    const handleDetach = useCallback(() => {
      detach()
      sendEvent('project-layout-detach')
    }, [detach, sendEvent])

    const handleReattach = useCallback(() => {
      if (detachRole !== 'detacher') {
        return
      }
      reattach()
      sendEvent('project-layout-reattach')
    }, [detachRole, reattach, sendEvent])

    const handleChangeLayout = useCallback(
      (newLayout: IdeLayout, newView?: IdeView) => {
        handleReattach()
        changeLayout(newLayout, newView)
        sendEvent('project-layout-change', {
          layout: newLayout,
          view: newView,
        })
      },
      [changeLayout, handleReattach, sendEvent]
    )
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
        restoreView,
        handleChangeLayout,
        handleDetach,
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
        restoreView,
        handleChangeLayout,
        handleDetach,
      ]
    )

    return (
      <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>
    )
  }
  return LayoutProvider
}

export function makeEditorPropertiesProvider(
  initialValues: Partial<
    Pick<
      EditorPropertiesContextValue,
      'showVisual' | 'showSymbolPalette' | 'wantTrackChanges'
    >
  >
) {
  const EditorPropertiesProvider: FC<PropsWithChildren> = ({ children }) => {
    const {
      showVisual: initialShowVisual,
      showSymbolPalette: initialShowSymbolPalette,
      wantTrackChanges: initialWantTrackChanges,
    } = initialValues

    const [showVisual, setShowVisual] = useState(initialShowVisual || false)
    const [showSymbolPalette, setShowSymbolPalette] = useState(
      initialShowSymbolPalette || false
    )

    function toggleSymbolPalette() {
      setShowSymbolPalette(show => !show)
    }

    const [opening, setOpening] = useState(true)
    const [trackChanges, setTrackChanges] = useState(false)
    const [wantTrackChanges, setWantTrackChanges] = useState(
      initialWantTrackChanges || false
    )
    const [errorState, setErrorState] = useState(false)

    const value = {
      showVisual,
      setShowVisual,
      showSymbolPalette,
      setShowSymbolPalette,
      toggleSymbolPalette,
      opening,
      setOpening,
      trackChanges,
      setTrackChanges,
      wantTrackChanges,
      setWantTrackChanges,
      errorState,
      setErrorState,
    }

    return (
      <EditorPropertiesContext.Provider value={value}>
        {children}
      </EditorPropertiesContext.Provider>
    )
  }

  return EditorPropertiesProvider
}

export function makeProjectProvider(initialProject: ProjectMetadata) {
  const ProjectProvider: FC<PropsWithChildren> = ({ children }) => {
    const [project, setProject] = useState(initialProject)

    const updateProject = useCallback((projectUpdateData: ProjectUpdate) => {
      setProject(projectData =>
        Object.assign({}, projectData, projectUpdateData)
      )
    }, [])

    const value = {
      projectId: project._id,
      project,
      joinProject: () => {},
      updateProject,
      joinedOnce: true,
      projectSnapshot: new ProjectSnapshot(project._id),
      tags: [],
      features: project.features,
      name: project.name,
    }

    return (
      <ProjectContext.Provider value={value}>
        {children}
      </ProjectContext.Provider>
    )
  }

  return ProjectProvider
}
