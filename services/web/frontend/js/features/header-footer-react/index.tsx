import ReactDOM from 'react-dom'
import getMeta from '@/utils/meta'
import DefaultNavbar from '@/features/ui/components/bootstrap-5/navbar/default-navbar'
import Footer from '@/features/ui/components/bootstrap-5/footer/footer'
import { SplitTestProvider } from '@/shared/context/split-test-context'

const navbarElement = document.getElementById('navbar-container')
if (navbarElement) {
  const navbarProps = getMeta('ol-navbar')
  ReactDOM.render(
    <SplitTestProvider>
      <DefaultNavbar {...navbarProps} />
    </SplitTestProvider>,
    navbarElement
  )
}

const footerElement = document.getElementById('footer-container')
if (footerElement) {
  const footerProps = getMeta('ol-footer')
  ReactDOM.render(<Footer {...footerProps} />, footerElement)
}
