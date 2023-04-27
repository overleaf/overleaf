import App from '../../../base'
import { react2angular } from 'react2angular'
import { rootContext } from '../../../shared/context/root-context'
import { LegacyEditorWarning } from '../components/legacy-editor-warning'

App.component(
  'legacyEditorWarning',
  react2angular(rootContext.use(LegacyEditorWarning), ['delay'])
)
