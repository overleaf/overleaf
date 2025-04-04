import { DependencyList, useEffect } from 'react'
import {
  Command,
  useCommandRegistry,
} from '../context/command-registry-context'

export const useCommandProvider = (
  generateElements: () => Command[] | undefined,
  dependencies: DependencyList
) => {
  const { register, unregister } = useCommandRegistry()
  useEffect(() => {
    const elements = generateElements()
    if (!elements) return
    register(...elements)
    return () => {
      unregister(...elements.map(element => element.id))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies)
}
