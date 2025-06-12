import { renderInReactLayout } from '@/react'
import PreviewSubscriptionChange from '@/features/subscription/components/preview-subscription-change/root'
import { SplitTestProvider } from '@/shared/context/split-test-context'

renderInReactLayout('subscription-preview-change', () => (
  <SplitTestProvider>
    <PreviewSubscriptionChange />
  </SplitTestProvider>
))
