import sinon from 'sinon'

export function setupContext() {
  window.project_id = '1234'
  window.user = {
    id: 'fake_user'
  }
  window.ExposedSettings = {
    appName: 'Overleaf'
  }
  let $scope = {}
  if (window._ide) {
    $scope = {
      ...window._ide.$scope,
      project: {},
      $watch: () => {},
      ui: {
        chatOpen: true
      }
    }
  }
  window._ide = {
    ...window._ide,
    $scope,
    socket: {
      on: sinon.stub(),
      removeListener: sinon.stub()
    }
  }
  window.ExposedSettings = window.ExposedSettings || {}
  window.ExposedSettings.gitBridgePublicBaseUrl = 'https://git.stories.com'
}
