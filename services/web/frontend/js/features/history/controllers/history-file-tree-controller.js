import App from '../../../base'
import { react2angular } from 'react2angular'
import { rootContext } from '../../../shared/context/root-context'
import HistoryFileTree from '../components/history-file-tree'

App.component(
  'historyFileTreeReact',
  react2angular(rootContext.use(HistoryFileTree))
)
