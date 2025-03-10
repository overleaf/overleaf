import { OutlineItemData } from '@/features/ide-react/types/outline'

export default function getChildrenLines(
  children?: OutlineItemData[]
): number[] {
  return (children || [])
    .map(child => {
      return getChildrenLines(child.children).concat(child.line)
    })
    .flat()
}
