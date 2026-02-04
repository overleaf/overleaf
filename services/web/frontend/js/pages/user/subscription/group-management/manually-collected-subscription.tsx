import '../base'
import { createRoot } from 'react-dom/client'
import ManuallyCollectedSubscription from '@/features/group-management/components/manually-collected-subscription'

const element = document.getElementById('manually-collected-subscription-root')
if (element) {
  const root = createRoot(element)
  root.render(<ManuallyCollectedSubscription />)
}
