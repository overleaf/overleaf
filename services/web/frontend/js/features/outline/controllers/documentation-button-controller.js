import { react2angular } from 'react2angular'
import DocumentationButton from '../components/documentation-button'
import { rootContext } from '../../../../../frontend/js/shared/context/root-context'
import App from '../../../../../frontend/js/base'

App.component(
  'documentationButton',
  react2angular(rootContext.use(DocumentationButton), [])
)
