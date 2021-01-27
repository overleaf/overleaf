import App from '../../../base'
import { react2angular } from 'react2angular'
import EditorNavigationToolbarRoot from '../components/editor-navigation-toolbar-root'
import { rootContext } from '../../../shared/context/root-context'

App.controller('EditorNavigationToolbarController', function($scope, ide) {
  $scope.onShowLeftMenuClick = () =>
    ide.$scope.$applyAsync(() => {
      ide.$scope.ui.leftMenuShown = !ide.$scope.ui.leftMenuShown
    })
})

App.component(
  'editorNavigationToolbarRoot',
  react2angular(rootContext.use(EditorNavigationToolbarRoot), [
    'onShowLeftMenuClick'
  ])
)
