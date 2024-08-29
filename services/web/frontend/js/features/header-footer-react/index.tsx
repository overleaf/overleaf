import ReactDOM from 'react-dom'
import getMeta from '@/utils/meta'
import DefaultNavbar from '@/features/ui/components/bootstrap-5/navbar/default-navbar'
import FatFooter from '@/features/ui/components/bootstrap-5/footer/fat-footer'

const navbarElement = document.getElementById('navbar-container')
if (navbarElement) {
  const navbarProps = getMeta('ol-navbar')
  ReactDOM.render(<DefaultNavbar {...navbarProps} />, navbarElement)
}

const footerElement = document.getElementById('fat-footer-container')
if (footerElement) {
  const footerProps = getMeta('ol-footer')
  ReactDOM.render(<FatFooter {...footerProps} />, footerElement)
}
