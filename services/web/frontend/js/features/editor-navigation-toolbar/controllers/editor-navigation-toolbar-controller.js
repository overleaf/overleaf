import App from '../../../base'
import { react2angular } from 'react2angular'
import EditorNavigationToolbarRoot from '../components/editor-navigation-toolbar-root'
import { rootContext } from '../../../shared/context/root-context'

App.controller('EditorNavigationToolbarController', [
  '$scope',
  'ide',
  function ($scope, ide) {
    // wrapper is required to avoid scope problems with `this` inside `EditorManager`
    $scope.openDoc = (doc, args) => ide.editorManager.openDoc(doc, args)
  },
])

App.component(
  'editorNavigationToolbarRoot',
  react2angular(rootContext.use(EditorNavigationToolbarRoot), [
    'openDoc',

    // `$scope.onlineUsersArray` is already populated by `OnlineUsersManager`, which also creates
    // a new array instance every time the list of online users change (which should refresh the
    // value passed to React as a prop, triggering a re-render)
    'onlineUsersArray',

    // We're still including ShareController as part fo the React navigation toolbar. The reason is
    // the coupling between ShareController's $scope and Angular's ShareProjectModal. Once ShareProjectModal
    // is fully ported to React we should be able to repli
    'openShareProjectModal',
  ])
)
