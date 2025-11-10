import { FC, PropsWithChildren, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
// @ts-expect-error this is using exportType: 'css-style-sheet'
import tailwindCSS from '../tailwind.css'

export const ShadowRootPortal: FC<PropsWithChildren> = ({ children }) => {
  const [shadowRoot, setShadowRoot] = useState<ShadowRoot | null>(null)

  const hostRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!shadowRoot && hostRef.current) {
      const shadowRoot = hostRef.current.attachShadow({ mode: 'open' })
      shadowRoot.adoptedStyleSheets = [tailwindCSS]
      setShadowRoot(shadowRoot)
    }
  }, [shadowRoot])

  return (
    <div
      ref={hostRef}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
      }}
    >
      {shadowRoot ? createPortal(children, shadowRoot) : null}
    </div>
  )
}
