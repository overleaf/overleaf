import App from '../../../base'
import { react2angular } from 'react2angular'
import { rootContext } from '../../../shared/context/root-context'
import GrammarlyAdvert from '../components/grammarly-advert'

App.component(
  'grammarlyAdvert',
  react2angular(rootContext.use(GrammarlyAdvert))
)
