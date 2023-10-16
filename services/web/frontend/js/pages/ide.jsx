// Configure dynamically loaded assets (via webpack) to be downloaded from CDN
import '../utils/webpack-public-path'

// Set up error reporting, including Sentry
import '../infrastructure/error-reporter'

import ReactDOM from 'react-dom'
import IdeRoot from '../features/ide-react/components/ide-root'

const element = document.getElementById('ide-root')
if (element) {
  // Remove loading screen provided by the server and replace it with the same
  // screen rendered in React. Could use replaceChildren() instead but browser
  // support is relatively recent (arrived in Safari in 2020)
  element.textContent = ''

  // This will not be valid in React 18, which has a new API. See
  // https://github.com/reactwg/react-18/discussions/5
  // https://react.dev/blog/2022/03/08/react-18-upgrade-guide#deprecations
  ReactDOM.render(<IdeRoot />, element)
}
