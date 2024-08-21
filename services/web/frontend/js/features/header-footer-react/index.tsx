import ReactDOM from 'react-dom'
import DefaultNavbar from '@/features/ui/components/bootstrap-5/navbar/default-navbar'
import getMeta from '@/utils/meta'

const element = document.getElementById('navbar-container')
if (element) {
  const navbarProps = getMeta('ol-navbar')
  ReactDOM.render(<DefaultNavbar {...navbarProps} />, element)
}
