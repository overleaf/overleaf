import './base'
import { createRoot } from 'react-dom/client'
import Root from '../../../features/subscription/components/successful-subscription/root'

const element = document.getElementById('subscription-success-root')
if (element) {
  const root = createRoot(element)
  root.render(<Root />)
}
