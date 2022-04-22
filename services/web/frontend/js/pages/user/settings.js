import '../../marketing'
import './../../utils/meta'
import './../../utils/webpack-public-path'
import './../../infrastructure/error-reporter'
import './../../i18n'
import '../../features/settings/components/root'
import ReactDOM from 'react-dom'
import SettingsPageRoot from '../../features/settings/components/root.tsx'

const element = document.getElementById('settings-page-root')
if (element) {
  ReactDOM.render(<SettingsPageRoot />, element)
}
