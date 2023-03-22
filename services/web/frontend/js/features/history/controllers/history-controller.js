import App from '../../../base'
import { react2angular } from 'react2angular'
import HistoryRoot from '../components/history-root'
import { rootContext } from '../../../shared/context/root-context'

App.component('historyRoot', react2angular(rootContext.use(HistoryRoot)))
