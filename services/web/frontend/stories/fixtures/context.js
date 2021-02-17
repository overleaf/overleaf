import sinon from 'sinon'

export function setupContext() {
  window.project_id = '1234'
  window.user = {
    id: 'fake_user'
  }
  let $scope = {}
  if (window._ide) {
    $scope = { ...window._ide.$scope, project: {} }
  }
  window._ide = {
    ...window._ide,
    $scope,
    socket: {
      on: sinon.stub(),
      removeListener: sinon.stub()
    }
  }
}
