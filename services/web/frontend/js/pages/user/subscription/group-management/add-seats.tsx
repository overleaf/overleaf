import '../base'
import ReactDOM from 'react-dom'
import Root from '@/features/group-management/components/add-seats/root'

const element = document.getElementById('add-seats-root')
if (element) {
  ReactDOM.render(<Root />, element)
}
