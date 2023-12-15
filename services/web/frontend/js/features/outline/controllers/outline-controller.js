import App from '@/base'
import { react2angular } from 'react2angular'
import { rootContext } from '@/shared/context/root-context'
import { OutlineContainer } from '@/features/outline/components/outline-container'

App.component(
  'outlineContainer',
  react2angular(rootContext.use(OutlineContainer))
)
