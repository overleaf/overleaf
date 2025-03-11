import '../base'
import ReactDOM from 'react-dom'
import SubtotalLimitExceeded from '@/features/group-management/components/subtotal-limit-exceeded'

const element = document.getElementById('subtotal-limit-exceeded-root')
if (element) {
  ReactDOM.render(<SubtotalLimitExceeded />, element)
}
