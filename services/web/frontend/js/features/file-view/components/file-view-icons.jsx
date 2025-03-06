import MaterialIcon from '@/shared/components/material-icon'

export const LinkedFileIcon = props => {
  return (
    <MaterialIcon
      type="open_in_new"
      modifier="rotate-180"
      className="align-middle linked-file-icon"
      {...props}
    />
  )
}
