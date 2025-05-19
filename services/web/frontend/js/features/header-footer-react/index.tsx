import { createRoot } from 'react-dom/client'
import getMeta from '@/utils/meta'
import { DefaultNavbarRoot } from '@/features/ui/components/bootstrap-5/navbar/default-navbar'
import Footer from '@/features/ui/components/bootstrap-5/footer/footer'
import { SplitTestProvider } from '@/shared/context/split-test-context'

const navbarElement = document.getElementById('navbar-container')
if (navbarElement) {
  const navbarProps = getMeta('ol-navbar')
  const root = createRoot(navbarElement)
  root.render(
    <SplitTestProvider>
      <DefaultNavbarRoot {...navbarProps} />
    </SplitTestProvider>
  )
}

const footerElement = document.getElementById('footer-container')
if (footerElement) {
  const footerProps = getMeta('ol-footer')
  const root = createRoot(footerElement)
  root.render(<Footer {...footerProps} />)
}
