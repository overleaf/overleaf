import './../utils/meta'
import '../utils/webpack-public-path'
import './../infrastructure/error-reporter'
import '@/i18n'
import ReactDOM from 'react-dom'
import TokenAccessRoot from '../features/token-access/components/token-access-root'

const element = document.getElementById('token-access-page')
if (element) {
  ReactDOM.render(<TokenAccessRoot />, element)
}
