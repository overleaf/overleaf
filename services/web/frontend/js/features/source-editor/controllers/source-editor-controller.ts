import { react2angular } from 'react2angular'
import SourceEditor from '../components/source-editor'
import App from '../../../base'
import { rootContext } from '../../../shared/context/root-context'

App.component('sourceEditor', react2angular(rootContext.use(SourceEditor), []))
