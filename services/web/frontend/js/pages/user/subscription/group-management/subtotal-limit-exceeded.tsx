import '../base'
import { createRoot } from 'react-dom/client'
import SubtotalLimitExceeded from '@/features/group-management/components/subtotal-limit-exceeded'

const element = document.getElementById('subtotal-limit-exceeded-root')
if (element) {
  const root = createRoot(element)
  root.render(<SubtotalLimitExceeded />)
}
