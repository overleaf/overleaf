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
      project: {},
      $watch: () => {},
      ui: {
        chatOpen: true,
        pdfLayout: 'flat',
      },
    }
  }
  window._ide = {
    ...window._ide,
    $scope,
    socket: {
      on: sinon.stub(),
      removeListener: sinon.stub(),
    },
  }
  window.ExposedSettings = window.ExposedSettings || {}
  window.ExposedSettings.appName = 'Overleaf'
  window.gitBridgePublicBaseUrl = 'https://git.stories.com'
}
