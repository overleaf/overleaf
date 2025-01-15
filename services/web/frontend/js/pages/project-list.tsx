import './../utils/meta'
import '../utils/webpack-public-path'
import './../infrastructure/error-reporter'
import '@/i18n'
import '../features/event-tracking'
import '../features/cookie-banner'
import '../features/link-helpers/slow-link'
import ReactDOM from 'react-dom'
import ProjectListRoot from '../features/project-list/components/project-list-root'

const element = document.getElementById('project-list-root')
if (element) {
  ReactDOM.render(<ProjectListRoot />, element)
}
