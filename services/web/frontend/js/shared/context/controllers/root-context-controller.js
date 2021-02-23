import App from '../../../base'
import { react2angular } from 'react2angular'
import { rootContext } from '../root-context'

App.component(
  'sharedContextReact',
  react2angular(rootContext.component, [], ['ide'])
)
