import { useEffect, useMemo } from 'react'
import { get } from 'lodash'
import { ContextRoot } from '../../js/shared/context/root-context'
import { User } from '../../../types/user'
import { Project } from '../../../types/project'
import {
  mockBuildFile,
  mockCompile,
  mockCompileError,
} from '../fixtures/compile'
import useFetchMock from '../hooks/use-fetch-mock'

const scopeWatchers: [string, (value: any) => void][] = []

const initialize = () => {
  const user: User = {
    id: 'story-user',
    email: 'story-user@example.com',
    allowedFreeTrial: true,
    features: { dropbox: true, symbolPalette: true },
  }

  const project: Project = {
    _id: 'a-project',
    name: 'A Project',
    features: { mendeley: true, zotero: true },
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
        docs: [],
        fileRefs: [],
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
        keys: [],
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
    toggleHistory: () => {},
    editor: {
      richText: false,
      newSourceEditor: false,
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
    fileTreeManager: {
      findEntityById: () => null,
      findEntityByPath: () => null,
      getEntityPath: () => null,
      getRootDocDirname: () => undefined,
      getPreviewByPath: (path: string) =>
        path === 'frog.jpg'
          ? {
              extension: 'png',
              url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAAEsCAYAAAB5fY51AAABhWlDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw0AcxV9TpaJVETuIOGSogmBBVMRRq1CECqFWaNXB5NIvaNKQpLg4Cq4FBz8Wqw4uzro6uAqC4AeIq4uToouU+L+k0CLWg+N+vLv3uHsHCNUi06y2cUDTbTMRi4qp9KoYeIWAPnShB6Mys4w5SYqj5fi6h4+vdxGe1frcn6NbzVgM8InEs8wwbeIN4ulN2+C8TxxieVklPiceM+mCxI9cVzx+45xzWeCZITOZmCcOEYu5JlaamOVNjXiKOKxqOuULKY9VzluctWKZ1e/JXxjM6CvLXKc5hBgWsQQJIhSUUUARNiK06qRYSNB+tIV/0PVL5FLIVQAjxwJK0CC7fvA/+N2tlZ2c8JKCUaD9xXE+hoHALlCrOM73sePUTgD/M3ClN/ylKjDzSXqloYWPgN5t4OK6oSl7wOUOMPBkyKbsSn6aQjYLvJ/RN6WB/lugc83rrb6P0wcgSV3Fb4CDQ2AkR9nrLd7d0dzbv2fq/f0ARfNylZJUgMQAAAAGYktHRABuAP8AAGHZRr4AAAAJcEhZcwAALiMAAC4jAXilP3YAAAAHdElNRQfnAhELEhgyPeVkAAAAGXRFWHRDb21tZW50AENyZWF0ZWQgd2l0aCBHSU1QV4EOFwAAAyVJREFUeNrt1rEJgDAURVGVNCmS2hS6PziCteIYWjuEbiEfOWeEV1xe35bt6QhjnlYjBJLzbYRABhMAggUgWIBgAQgWgGABggUgWACCBQgWgGABCBYgWACCBSBYgGABCBaAYAGCBSBYAIIFCBaAYAEIFiBYAIIFIFiAYAEIFiBYAIIFIFiAYAEIFoBgAYIFIFgAggUIFoBgAQgWIFgAggUgWIBgAQgWgGABggUgWACCBQgWgGABCBYgWACCBSBYgGABCBYgWACCBSBYgGABCBaAYAGCBSBYAIIFCBaAYAEIFiBYAIIFIFiAYAEIFoBgAYIFIFgAggUIFoBgAQgWIFgAggUgWIBgAQgWIFgAggUgWIBgAQgWgGABggUgWACCBQgWgGABCBbwX6m13QqB5HwbIZBSLyN4WACCBQgWgGABCBYgWACCBSBYgGABCBaAYAGCBSBYAIIFCBaAYAEIFiBYAIIFCBaAYAEIFiBYAIIFIFiAYAEIFoBgAYIFIFgAggUIFoBgAQgWIFgAggUgWIBgAQgWgGABggUgWACCBQgWgGABCBYgWACCBQgWgGABCBYgWACCBSBYgGABCBaAYAGCBSBYAIIFCBaAYAEIFiBYAIIFIFiAYAEIFoBgAYIFIFgAggUIFoBgAQgWIFgAggUIFoBgAQgWIFgAggUgWIBgAQgWgGABggUgWACCBQgWgGABCBYgWACCBSBYgGABCBaAYAGCBfCFVMtphUBKvYwQSBsPI3hYAIIFCBaAYAEIFiBYAIIFIFiAYAEIFoBgAYIFIFgAggUIFoBgAQgWIFgAggUIFoBgAQgWIFgAggUgWIBgAQgWgGABggUgWACCBQgWgGABCBYgWACCBSBYgGABCBaAYAGCBSBYAIIFCBaAYAEIFiBYAIIFCBaAYAEIFiBYAIIFIFiAYAEIFoBgAYIFIFgAggUIFoBgAQgWIFgAggUgWIBgAQgWgGABggUgWACCBQgWgGABCBYgWACCBQgWgGABCBYgWACCBSBYgGABCBaAYAGCBSBYAIIFCBaAYAEIFiBYAIIFIFiAYAEIFoBgAYIF8IUXjtUMuBMh1xAAAAAASUVORK5CYII=',
            }
          : null,
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
          documents: {},
        },
      },
    },
  }

  window.user = user

  window.ExposedSettings = {
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
    isOverleaf: true,
    labsEnabled: true,
    maxEntitiesPerProject: 10,
    maxUploadSize: 5 * 1024 * 1024,
    recaptchaDisabled: {
      invite: true,
      login: true,
      passwordReset: true,
      register: true,
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
      'latexmkrc',
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
    ],
    validRootDocExtensions: ['tex', 'Rtex', 'ltx'],
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
}

export const ScopeDecorator = (
  Story: any,
  opts: ScopeDecoratorOptions = { mockCompileOnLoad: true }
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

  return (
    <ContextRoot ide={ide} settings={{}}>
      <Story />
    </ContextRoot>
  )
}
