import sinon from 'sinon'

export function setupContext() {
  window.project_id = '1234'
  window.user = {
    id: 'fake_user',
    allowedFreeTrial: true,
  }
  let $scope = {}
  if (window._ide) {
    $scope = {
      ...window._ide.$scope,
      user: window.user,
      project: {},
      $watch: () => {},
      $applyAsync: () => {},
      ui: {
        chatOpen: true,
        pdfLayout: 'flat',
      },
      toggleHistory: () => {},
    }
  }
  window._ide = {
    ...window._ide,
    $scope,
    socket: {
      on: sinon.stub(),
      removeListener: sinon.stub(),
    },
    fileTreeManager: {
      findEntityByPath: () => null,
      getRootDocDirname: () => undefined,
    },
  }
  window.ExposedSettings = window.ExposedSettings || {}
  window.ExposedSettings.appName = 'Overleaf'
  window.gitBridgePublicBaseUrl = 'https://git.stories.com'
}
