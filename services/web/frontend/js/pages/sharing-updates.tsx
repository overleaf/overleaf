import './../utils/meta'
import '../utils/webpack-public-path'
import './../infrastructure/error-reporter'
import '@/i18n'
import ReactDOM from 'react-dom'
import SharingUpdatesRoot from '../features/token-access/components/sharing-updates-root'

const element = document.getElementById('sharing-updates-page')
if (element) {
  ReactDOM.render(<SharingUpdatesRoot />, element)
}
