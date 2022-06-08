import App from '../../../base'
import { react2angular } from 'react2angular'
import { rootContext } from '../../../shared/context/root-context'
import EditorExpandButton from '../../../features/source-editor/components/editor-expand-button'

App.component(
  'editorExpandButton',
  react2angular(rootContext.use(EditorExpandButton))
)
