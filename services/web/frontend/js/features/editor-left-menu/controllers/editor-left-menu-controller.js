import App from '../../../base'
import { react2angular } from 'react2angular'
import { rootContext } from '../../../shared/context/root-context'
import EditorLeftMenu from '../components/editor-left-menu'

App.component('editorLeftMenu', react2angular(rootContext.use(EditorLeftMenu)))
