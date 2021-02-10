import App from '../../../base'
import { react2angular } from 'react2angular'
import { rootContext } from '../root-context'

App.controller('ReactRootContextController', function($scope, ide) {
  $scope.editorLoading = !!ide.$scope.state.loading
  ide.$scope.$watch('state.loading', editorLoading => {
    $scope.editorLoading = editorLoading
  })

  $scope.setChatIsOpenAngular = value => {
    ide.$scope.$applyAsync(() => {
      ide.$scope.ui.chatOpen = value
    })
  }

  // we need to pass `$scope.ui.chatOpen` to Angular while both React and Angular
  // Navigation Toolbars exist in the codebase. Once the Angular version is removed,
  // the React Navigation Toolbar will be the only source of truth for the open/closed state,
  // but `setChatIsOpenAngular` will still need to exist since Angular is responsible of the
  // global layout
  $scope.chatIsOpenAngular = ide.$scope.ui.chatOpen
  ide.$scope.$watch('ui.chatOpen', value => {
    $scope.chatIsOpenAngular = value
  })

  // wrapper is required to avoid scope problems with `this` inside `EditorManager`
  $scope.openDoc = (doc, args) => ide.editorManager.openDoc(doc, args)
})

App.component(
  'sharedContextReact',
  react2angular(rootContext.component, [
    'editorLoading',
    'setChatIsOpenAngular',
    'chatIsOpenAngular',
    'openDoc',
    // `$scope.onlineUsersArray` is already populated by `OnlineUsersManager`, which also creates
    // a new array instance every time the list of online users change (which should refresh the
    // value passed to React as a prop, triggering a re-render)
    'onlineUsersArray'
  ])
)
