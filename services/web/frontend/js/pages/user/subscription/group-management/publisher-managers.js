import '../base'
import ReactDOM from 'react-dom'
import Root from '../../../../features/group-management/components/publisher-managers'

const element = document.getElementById('subscription-manage-group-root')
if (element) {
  ReactDOM.render(<Root />, element)
}
