import '../base'
import { createRoot } from 'react-dom/client'
import MissingBillingInformation from '@/features/group-management/components/missing-billing-information'

const element = document.getElementById('missing-billing-information-root')
if (element) {
  const root = createRoot(element)
  root.render(<MissingBillingInformation />)
}
