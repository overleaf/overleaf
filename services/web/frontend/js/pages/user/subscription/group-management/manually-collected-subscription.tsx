import '../base'
import ReactDOM from 'react-dom'
import ManuallyCollectedSubscription from '@/features/group-management/components/manually-collected-subscription'

const element = document.getElementById('manually-collected-subscription-root')
if (element) {
  ReactDOM.render(<ManuallyCollectedSubscription />, element)
}
