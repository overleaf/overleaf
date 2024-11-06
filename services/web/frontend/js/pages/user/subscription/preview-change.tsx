import '@/marketing'
import ReactDOM from 'react-dom'
import PreviewSubscriptionChange from '@/features/subscription/components/preview-subscription-change/root'

const element = document.getElementById('subscription-preview-change')
if (element) {
  ReactDOM.render(<PreviewSubscriptionChange />, element)
}
