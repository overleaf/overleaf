import './base'
import { createRoot } from 'react-dom/client'
import Root from '../../../features/subscription/components/canceled-subscription/root'

const element = document.getElementById('subscription-canceled-root')
if (element) {
  const root = createRoot(element)
  root.render(<Root />)
}
