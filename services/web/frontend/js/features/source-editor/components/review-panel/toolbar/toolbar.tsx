import ResolvedCommentsDropdown from './resolved-comments-dropdown'
import ToggleMenu from './toggle-menu'

function Toolbar() {
  return (
    <div className="review-panel-toolbar">
      <ResolvedCommentsDropdown />
      <ToggleMenu />
    </div>
  )
}

export default Toolbar
