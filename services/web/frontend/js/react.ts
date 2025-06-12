import './marketing'
import './features/header-footer-react'
import { createRoot } from 'react-dom/client'
import { ReactNode } from 'react'

export function renderInReactLayout(
  parentId: string,
  createChildren: () => ReactNode
) {
  const parentElement = document.getElementById(parentId)
  if (parentElement) {
    const root = createRoot(parentElement)
    root.render(createChildren())
  }
}
