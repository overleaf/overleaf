import '../utils/webpack-public-path' // configure dynamically loaded assets (via webpack) to be downloaded from CDN
import '../infrastructure/error-reporter' // set up error reporting, including Sentry
import ReactDOM from 'react-dom'
import IdeRoot from '@/features/ide-react/components/ide-root'

ReactDOM.render(<IdeRoot />, document.getElementById('ide-root'))
