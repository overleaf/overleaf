import App from '../../../base'
import { react2angular } from 'react2angular'
import EditorSwitch from '../components/editor-switch'
import { rootContext } from '../../../shared/context/root-context'

App.component('editorSwitch', react2angular(rootContext.use(EditorSwitch)))
