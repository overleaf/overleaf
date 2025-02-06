import { useRail } from './use-rail'

export const usePdfPane = () => {
  // FIXME: This is temporary, to avoid clashing with the existing usePdfPane
  // which uses the layout context. That's the correct approach.
  return useRail()
}
