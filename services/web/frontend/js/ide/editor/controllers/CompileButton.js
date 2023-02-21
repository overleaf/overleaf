import App from '../../../base'
import { react2angular } from 'react2angular'
import { rootContext } from '../../../shared/context/root-context'
import DetachCompileButtonWrapper from '../../../features/pdf-preview/components/detach-compile-button-wrapper'

App.component(
  'editorCompileButton',
  react2angular(rootContext.use(DetachCompileButtonWrapper))
)
