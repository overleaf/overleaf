import DownloadMenu from './download-menu'
import ActionsMenu from './actions-menu'
import HelpMenu from './help-menu'
import { useLayoutContext } from '../../../shared/context/layout-context'
import classNames from 'classnames'

export default function EditorLeftMenu() {
  const { leftMenuShown, setLeftMenuShown } = useLayoutContext()

  return (
    <>
      <aside
        id="left-menu"
        className={classNames('full-size', { shown: leftMenuShown })}
      >
        <DownloadMenu />
        <ActionsMenu />
        <HelpMenu />
      </aside>
      {leftMenuShown ? (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div id="left-menu-mask" onClick={() => setLeftMenuShown(false)} />
      ) : null}
    </>
  )
}
