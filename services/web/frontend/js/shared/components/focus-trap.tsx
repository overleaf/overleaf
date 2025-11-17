import { useRef } from 'react'
import {
  FocusTrap as FocusTrapReact,
  FocusTrapProps as FocusTrapReactProps,
} from 'focus-trap-react'

export type FocusTrapProps = {
  active: FocusTrapReactProps['active']
  children: React.ReactNode
  focusTrapOptions?: FocusTrapReactProps['focusTrapOptions']
}

export default function FocusTrap({
  active,
  focusTrapOptions,
  children,
}: FocusTrapProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  return (
    <FocusTrapReact
      active={active}
      focusTrapOptions={{
        ...focusTrapOptions,
        fallbackFocus: () => containerRef.current as HTMLElement,
      }}
    >
      <div ref={containerRef}>{children}</div>
    </FocusTrapReact>
  )
}
