import '../base'
import { createRoot } from 'react-dom/client'
import ManuallyCollectedSubscription from '@/features/group-management/components/manually-collected-subscription'
import { SplitTestProvider } from '@/shared/context/split-test-context'

const element = document.getElementById('manually-collected-subscription-root')
if (element) {
  const root = createRoot(element)
  root.render(
    <SplitTestProvider>
      <ManuallyCollectedSubscription />
    </SplitTestProvider>
  )
}
