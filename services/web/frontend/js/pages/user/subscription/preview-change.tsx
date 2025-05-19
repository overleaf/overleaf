import '@/marketing'
import { createRoot } from 'react-dom/client'
import PreviewSubscriptionChange from '@/features/subscription/components/preview-subscription-change/root'
import { SplitTestProvider } from '@/shared/context/split-test-context'

const element = document.getElementById('subscription-preview-change')
if (element) {
  const root = createRoot(element)
  root.render(
    <SplitTestProvider>
      <PreviewSubscriptionChange />
    </SplitTestProvider>
  )
}
