import '../base'
import ReactDOM from 'react-dom'
import MissingBillingInformation from '@/features/group-management/components/missing-billing-information'

const element = document.getElementById('missing-billing-information-root')
if (element) {
  ReactDOM.render(<MissingBillingInformation />, element)
}
