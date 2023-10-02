// Configure dynamically loaded assets (via webpack) to be downloaded from CDN
import '../utils/webpack-public-path'

// Set up error reporting, including Sentry
import '../infrastructure/error-reporter'

import ReactDOM from 'react-dom'
import IdeRoot from '../features/ide-react/components/ide-root'

const element = document.getElementById('ide-root')
if (element) {
  ReactDOM.render(<IdeRoot />, element)
}
