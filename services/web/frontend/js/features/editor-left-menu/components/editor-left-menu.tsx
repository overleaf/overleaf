import DownloadMenu from './download-menu'
import ActionsMenu from './actions-menu'
import HelpMenu from './help-menu'
import { useLayoutContext } from '../../../shared/context/layout-context'
import SyncMenu from './sync-menu'
import SettingsMenu from './settings-menu'
import LeftMenuMask from './left-menu-mask'
import AccessibleModal from '../../../shared/components/accessible-modal'
import { Modal } from 'react-bootstrap'
import classNames from 'classnames'

export default function EditorLeftMenu() {
  const { leftMenuShown, setLeftMenuShown } = useLayoutContext()

  const closeModal = () => {
    setLeftMenuShown(false)
  }

  return (
    <>
      <AccessibleModal
        backdropClassName="left-menu-modal-backdrop"
        keyboard
        onHide={closeModal}
        id="left-menu-modal"
        show={leftMenuShown}
      >
        <Modal.Body
          className={classNames('full-size', { shown: leftMenuShown })}
          id="left-menu"
        >
          <DownloadMenu />
          <ActionsMenu />
          <SyncMenu />
          <SettingsMenu />
          <HelpMenu />
        </Modal.Body>
      </AccessibleModal>
      {leftMenuShown && <LeftMenuMask />}
    </>
  )
}
