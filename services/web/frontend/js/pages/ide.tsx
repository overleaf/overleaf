import '../utils/webpack-public-path' // configure dynamically loaded assets (via webpack) to be downloaded from CDN
import '../infrastructure/error-reporter' // set up error reporting, including Sentry
import '../infrastructure/hotjar' // set up Hotjar
import ReactDOM from 'react-dom'
import IdeRoot from '@/features/ide-react/components/ide-root'

ReactDOM.render(<IdeRoot />, document.getElementById('ide-root'))

// work around Safari 15's incomplete support for dvh units
// https://github.com/overleaf/internal/issues/18109
try {
  if (
    document.body.parentElement &&
    document.body.parentElement?.clientHeight < document.body.clientHeight
  ) {
    const rootElement = document.querySelector<HTMLDivElement>('#ide-root')
    if (rootElement) {
      rootElement.style.height = '100vh'
    }
  }
} catch {
  // ignore errors
}
