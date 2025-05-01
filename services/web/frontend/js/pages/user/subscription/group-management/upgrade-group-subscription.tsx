import '../base'
import { createRoot } from 'react-dom/client'
import Root from '@/features/group-management/components/upgrade-subscription/root'

const element = document.getElementById('upgrade-group-subscription-root')
if (element) {
  const root = createRoot(element)
  root.render(<Root />)
}
