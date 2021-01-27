import App from '../../../base'
import { react2angular } from 'react2angular'
import { rootContext } from '../root-context'

App.controller('ReactRootContextController', function($scope, ide) {
  $scope.editorLoading = !!ide.$scope.state.loading
  ide.$scope.$watch('state.loading', editorLoading => {
    $scope.editorLoading = editorLoading
  })
})

App.component(
  'sharedContextReact',
  react2angular(rootContext.component, ['editorLoading'])
)
