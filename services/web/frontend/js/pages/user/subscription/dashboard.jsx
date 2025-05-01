import './base'
import { createRoot } from 'react-dom/client'
import Root from '../../../features/subscription/components/dashboard/root'

const element = document.getElementById('subscription-dashboard-root')
if (element) {
  const root = createRoot(element)
  root.render(<Root />)
}
