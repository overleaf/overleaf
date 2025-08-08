import { useLayoutContext } from '../../../shared/context/layout-context'
import LeftMenuMask from './left-menu-mask'
import classNames from 'classnames'
import { lazy, memo, Suspense } from 'react'
import { FullSizeLoadingSpinner } from '@/shared/components/loading-spinner'
import { Offcanvas } from 'react-bootstrap'
import { EditorLeftMenuProvider } from './editor-left-menu-context'
import withErrorBoundary from '@/infrastructure/error-boundary'
import OLNotification from '@/shared/components/ol/ol-notification'
import { useTranslation } from 'react-i18next'

const EditorLeftMenuBody = lazy(() => import('./editor-left-menu-body'))

const LazyEditorLeftMenuWithErrorBoundary = withErrorBoundary(
  () => (
    <Suspense fallback={<FullSizeLoadingSpinner delay={500} />}>
      <EditorLeftMenuBody />
    </Suspense>
  ),
  () => {
    const { t } = useTranslation()
    return <OLNotification type="error" content={t('something_went_wrong')} />
  }
)

function EditorLeftMenu() {
  const { leftMenuShown, setLeftMenuShown } = useLayoutContext()

  const closeLeftMenu = () => {
    setLeftMenuShown(false)
  }

  return (
    <EditorLeftMenuProvider>
      <Offcanvas
        show={leftMenuShown}
        onHide={closeLeftMenu}
        backdropClassName="left-menu-modal-backdrop"
        id="left-menu-offcanvas"
      >
        <Offcanvas.Body
          className={classNames('full-size', 'left-menu', {
            shown: leftMenuShown,
          })}
          id="left-menu"
          data-testid="left-menu"
        >
          <LazyEditorLeftMenuWithErrorBoundary />
        </Offcanvas.Body>
      </Offcanvas>
      {leftMenuShown && <LeftMenuMask />}
    </EditorLeftMenuProvider>
  )
}

export default memo(EditorLeftMenu)
