import DownloadMenu from './download-menu'
import ActionsMenu from './actions-menu'
import HelpMenu from './help-menu'
import { useLayoutContext } from '../../../shared/context/layout-context'
import classNames from 'classnames'
import SyncMenu from './sync-menu'
import SettingsMenu from './settings-menu'
import LeftMenuMask from './left-menu-mask'

export default function EditorLeftMenu() {
  const { leftMenuShown } = useLayoutContext()

  return (
    <>
      <aside
        id="left-menu"
        className={classNames('full-size', { shown: leftMenuShown })}
      >
        <DownloadMenu />
        <ActionsMenu />
        <SyncMenu />
        <SettingsMenu />
        <HelpMenu />
      </aside>
      {leftMenuShown && <LeftMenuMask />}
    </>
  )
}
