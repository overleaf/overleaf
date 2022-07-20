import App from '../../../base'
import { react2angular } from 'react2angular'
import { rootContext } from '../../../shared/context/root-context'
import SwitchToPDFButton from '../../../features/source-editor/components/switch-to-pdf-button'

App.component(
  'switchToPdfButton',
  react2angular(rootContext.use(SwitchToPDFButton))
)
