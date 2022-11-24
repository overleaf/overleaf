import App from '../../../base'
import { react2angular } from 'react2angular'
import { rootContext } from '../../../shared/context/root-context'
import GrammarlyWarning from '../components/grammarly-warning'

App.component(
  'grammarlyWarning',
  react2angular(rootContext.use(GrammarlyWarning), ['delay'])
)
