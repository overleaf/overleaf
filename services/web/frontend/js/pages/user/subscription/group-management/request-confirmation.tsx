import '../base'
import ReactDOM from 'react-dom'
import RequestConfirmation from '@/features/group-management/components/request-confirmation'

const element = document.getElementById('subscription-manage-group-root')
if (element) {
  ReactDOM.render(<RequestConfirmation />, element)
}
