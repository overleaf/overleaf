import { useLayoutContext } from '../../../shared/context/layout-context'
import LeftMenuMask from './left-menu-mask'
import AccessibleModal from '../../../shared/components/accessible-modal'
import { Modal } from 'react-bootstrap'
import classNames from 'classnames'
import { lazy, memo, Suspense } from 'react'
import { FullSizeLoadingSpinner } from '@/shared/components/loading-spinner'
const EditorLeftMenuBody = lazy(() => import('./editor-left-menu-body'))

function EditorLeftMenu() {
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
          <Suspense fallback={<FullSizeLoadingSpinner delay={500} />}>
            <EditorLeftMenuBody />
          </Suspense>
        </Modal.Body>
      </AccessibleModal>
      {leftMenuShown && <LeftMenuMask />}
    </>
  )
}

export default memo(EditorLeftMenu)
