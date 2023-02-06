import '../base'
import ReactDOM from 'react-dom'
import Root from '../../../../features/group-management/components/group-managers'

const element = document.getElementById('subscription-manage-group-root')
if (element) {
  ReactDOM.render(<Root />, element)
}
