import MaterialIcon, { IconProps } from '@/shared/components/material-icon'

export const LinkedFileIcon = (
  props: Omit<IconProps, 'type' | 'modifier' | 'className' | 'unfilled' | 'ref'>
) => {
  return (
    <MaterialIcon
      type="open_in_new"
      modifier="rotate-180"
      className="align-middle linked-file-icon"
      {...props}
    />
  )
}
