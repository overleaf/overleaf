import App from '../../../base'
import { react2angular } from 'react2angular'
import { rootContext } from '../../../shared/context/root-context'

import ChatPane from '../components/chat-pane'

App.controller('ReactChatController', function($scope, ide) {
  $scope.resetUnreadMessages = () =>
    ide.$scope.$broadcast('chat:resetUnreadMessages')
})

App.component(
  'chat',
  react2angular(rootContext.use(ChatPane), ['resetUnreadMessages'])
)
