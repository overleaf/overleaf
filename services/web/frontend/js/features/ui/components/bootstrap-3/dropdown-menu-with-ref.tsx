import { forwardRef, SyntheticEvent } from 'react'
import classnames from 'classnames'
import RootCloseWrapper from 'react-overlays/lib/RootCloseWrapper'
import { DropdownProps } from 'react-bootstrap'
import { MergeAndOverride } from '../../../../../../types/utils'

type DropdownMenuWithRefProps = MergeAndOverride<
  Pick<DropdownProps, 'bsClass' | 'open' | 'pullRight' | 'onClose'>,
  {
    children: React.ReactNode
    bsRole: 'menu'
    menuRef: React.MutableRefObject<HTMLElement | undefined>
    className?: string
    // The props below are passed by react-bootstrap
    labelledBy?: string | undefined
    rootCloseEvent?: 'click' | 'mousedown' | undefined
    onClose?: (e: SyntheticEvent<any>) => void
  }
>

const DropdownMenuWithRef = forwardRef<
  HTMLUListElement,
  DropdownMenuWithRefProps
>(function (props, ref) {
  const {
    children,
    bsRole,
    bsClass,
    className,
    open,
    pullRight,
    labelledBy,
    menuRef,
    onClose,
    rootCloseEvent,
    ...rest
  } = props

  // expose the menu reference to both the `menuRef` and `ref callback` from react-bootstrap
  const handleRefs = (node: HTMLUListElement) => {
    if (typeof ref === 'function') {
      ref(node)
    }
    menuRef.current = node
  }

  // Implementation as suggested in
  // https://react-bootstrap-v3.netlify.app/components/dropdowns/#btn-dropdowns-props-dropdown
  return (
    <RootCloseWrapper
      disabled={!open}
      onRootClose={onClose}
      event={rootCloseEvent}
    >
      <ul
        role={bsRole}
        className={classnames(className, bsClass, {
          'dropdown-menu-right': pullRight,
        })}
        aria-labelledby={labelledBy}
        ref={handleRefs}
        {...rest}
      >
        {children}
      </ul>
    </RootCloseWrapper>
  )
})
DropdownMenuWithRef.displayName = 'DropdownMenuWithRef'

export default DropdownMenuWithRef
