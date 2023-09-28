import './base'
import ReactDOM from 'react-dom'
import Root from '../../../features/subscription/components/new/root'

const element = document.getElementById('subscription-new-root')
if (element) {
  ReactDOM.render(<Root />, element)
}
