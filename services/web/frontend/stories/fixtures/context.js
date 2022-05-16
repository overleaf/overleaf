import sinon from 'sinon'

export function setupContext() {
  window.project_id = '1234'
  window.user = {
    id: 'fake_user',
    allowedFreeTrial: true,
  }
  const $scope = {
    ...window._ide?.$scope,
    user: window.user,
    project: {
      _id: window.project_id,
      name: 'Project Fake Name',
      features: {},
      rootFolder: [
        {
          _id: 'root-folder-id',
          name: 'rootFolder',
          docs: [],
          folders: [],
          fileRefs: [],
        },
      ],
    },
    $watch: () => {},
    $applyAsync: () => {},
    $broadcast: () => {},
    ui: {
      chatOpen: true,
      pdfLayout: 'flat',
    },
    settings: {
      pdfViewer: 'js',
    },
    toggleHistory: () => {},
  }
  window._ide = {
    ...window._ide,
    $scope,
    socket: {
      on: sinon.stub(),
      removeListener: sinon.stub(),
    },
    fileTreeManager: {
      findEntityById: () => null,
      findEntityByPath: () => null,
      getEntityPath: () => null,
      getRootDocDirname: () => undefined,
    },
    editorManager: {
      getCurrentDocId: () => 'foo',
      openDoc: (id, options) => {
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
  window.ExposedSettings = window.ExposedSettings || {}
  window.ExposedSettings.appName = 'Overleaf'
  window.gitBridgePublicBaseUrl = 'https://git.stories.com'

  window.metaAttributesCache = window.metaAttributesCache || new Map()
  window.metaAttributesCache.set('ol-user', window.user)
}
