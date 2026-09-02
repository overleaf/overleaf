import '../base'
import { createRoot } from 'react-dom/client'
import Root from '../../../../features/group-management/components/institution-managers'

const element = document.getElementById('subscription-manage-group-root')
if (element) {
  const root = createRoot(element)
  root.render(<Root />)
}
