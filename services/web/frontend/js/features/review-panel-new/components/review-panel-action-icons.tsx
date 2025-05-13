import { memo } from 'react'
import MaterialIcon from '@/shared/components/material-icon'

export const AddIcon = memo(function AddIcon() {
  return (
    <MaterialIcon
      className="review-panel-entry-icon review-panel-entry-change-icon review-panel-entry-icon-accept"
      type="add_circle"
    />
  )
})

export const DeleteIcon = memo(function DeleteIcon() {
  return (
    <MaterialIcon
      className="review-panel-entry-icon review-panel-entry-change-icon review-panel-entry-icon-reject"
      type="delete"
    />
  )
})

export const EditIcon = memo(function EditIcon() {
  return (
    <MaterialIcon
      className="review-panel-entry-icon review-panel-entry-change-icon review-panel-entry-icon-changed"
      type="edit"
    />
  )
})
