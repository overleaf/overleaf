import App from '../../base'
import { rootContext } from '../../shared/context/root-context'
import ChatPane from '../../features/chat/components/chat-pane'
import { react2angular } from 'react2angular'

App.component('chat', react2angular(rootContext.use(ChatPane)))
