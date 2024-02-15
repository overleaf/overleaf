import { useEffect, useMemo } from 'react'
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
import { SplitTestProvider } from '@/shared/context/split-test-context'
import { IdeAngularProvider } from '@/shared/context/ide-angular-provider'
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
import { ChatProvider } from '@/features/chat/context/chat-context'

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
    features: { mendeley: true, zotero: true },
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
        fileRefs: [{ _id: 'test-image-id', name: 'frog.jpg' }],
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
    $root: {
      _references: {
        keys: ['bibkeyExample'],
      },
    },
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
    },
    hasLintingError: false,
    permissionsLevel: 'owner',
  }

  const ide = {
    $scope: scope,
    socket: {
      on: () => {},
      removeListener: () => {},
    },
    editorManager: {
      getCurrentDocId: () => 'foo',
      openDoc: (id: string, options: unknown) => {
        console.log('open doc', id, options)
      },
    },
    metadataManager: {
      metadata: {
        state: {
          documents: {
            'test-file-id': { labels: ['sec:section-label'], packages: [] },
          },
        },
      },
    },
  }

  window.user = user

  window.ExposedSettings = {
    adminEmail: 'placeholder@example.com',
    appName: 'Overleaf',
    cookieDomain: '.overleaf.stories',
    dropboxAppName: 'Overleaf-Stories',
    emailConfirmationDisabled: false,
    enableSubscriptions: true,
    hasAffiliationsFeature: false,
    hasLinkUrlFeature: false,
    hasLinkedProjectFileFeature: true,
    hasLinkedProjectOutputFileFeature: true,
    hasSamlFeature: true,
    ieeeBrandId: 15,
    isOverleaf: true,
    labsEnabled: true,
    maxEntitiesPerProject: 10,
    maxUploadSize: 5 * 1024 * 1024,
    recaptchaDisabled: {
      invite: true,
      login: true,
      passwordReset: true,
      register: true,
      addEmail: true,
    },
    sentryAllowedOriginRegex: '',
    siteUrl: 'http://localhost',
    templateLinks: [],
    textExtensions: [
      'tex',
      'latex',
      'sty',
      'cls',
      'bst',
      'bib',
      'bibtex',
      'txt',
      'tikz',
      'mtx',
      'rtex',
      'md',
      'asy',
      'lbx',
      'bbx',
      'cbx',
      'm',
      'lco',
      'dtx',
      'ins',
      'ist',
      'def',
      'clo',
      'ldf',
      'rmd',
      'lua',
      'gv',
      'mf',
      'lhs',
      'mk',
      'xmpdata',
      'cfg',
      'rnw',
      'ltx',
      'inc',
    ],
    editableFilenames: ['latexmkrc', '.latexmkrc', 'makefile', 'gnumakefile'],
    validRootDocExtensions: ['tex', 'Rtex', 'ltx', 'Rnw'],
    fileIgnorePattern:
      '**/{{__MACOSX,.git,.texpadtmp,.R}{,/**},.!(latexmkrc),*.{dvi,aux,log,toc,out,pdfsync,synctex,synctex(busy),fdb_latexmk,fls,nlo,ind,glo,gls,glg,bbl,blg,doc,docx,gz,swp}}',
    projectUploadTimeout: 12000,
  }

  window.project_id = project._id

  window.metaAttributesCache = new Map()
  window.metaAttributesCache.set('ol-user', user)

  window.gitBridgePublicBaseUrl = 'https://git.stories.com'

  window._ide = ide

  return ide
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

  const ide = useMemo(() => {
    return initialize()
  }, [])

  // set values on window.metaAttributesCache (created in initialize, above)
  useMeta(meta)

  const Providers = {
    ChatProvider,
    DetachCompileProvider,
    DetachProvider,
    EditorProvider,
    FileTreeDataProvider,
    FileTreePathProvider,
    IdeAngularProvider,
    LayoutProvider,
    LocalCompileProvider,
    OutlineProvider,
    ProjectProvider,
    ProjectSettingsProvider,
    SplitTestProvider,
    UserProvider,
    UserSettingsProvider,
    ...opts.providers,
  }

  return (
    <Providers.SplitTestProvider>
      <Providers.IdeAngularProvider ide={ide}>
        <Providers.UserProvider>
          <Providers.UserSettingsProvider>
            <Providers.ProjectProvider>
              <Providers.FileTreeDataProvider>
                <Providers.FileTreePathProvider>
                  <Providers.DetachProvider>
                    <Providers.EditorProvider>
                      <Providers.ProjectSettingsProvider>
                        <Providers.LayoutProvider>
                          <Providers.LocalCompileProvider>
                            <Providers.DetachCompileProvider>
                              <Providers.ChatProvider>
                                <Providers.OutlineProvider>
                                  <Story />
                                </Providers.OutlineProvider>
                              </Providers.ChatProvider>
                            </Providers.DetachCompileProvider>
                          </Providers.LocalCompileProvider>
                        </Providers.LayoutProvider>
                      </Providers.ProjectSettingsProvider>
                    </Providers.EditorProvider>
                  </Providers.DetachProvider>
                </Providers.FileTreePathProvider>
              </Providers.FileTreeDataProvider>
            </Providers.ProjectProvider>
          </Providers.UserSettingsProvider>
        </Providers.UserProvider>
      </Providers.IdeAngularProvider>
    </Providers.SplitTestProvider>
  )
}
