import { useSelectableEntity } from '../contexts/file-tree-selectable'
import FileTreeIcon from './file-tree-icon'
import FileTreeItemInner from './file-tree-item/file-tree-item-inner'

function FileTreeDoc({
  name,
  id,
  isFile,
  isLinkedFile,
}: {
  name: string
  id: string
  isFile?: boolean
  isLinkedFile?: boolean
}) {
  const type = isFile ? 'file' : 'doc'

  const { isSelected, props: selectableEntityProps } = useSelectableEntity(
    id,
    type
  )

  return (
    <li
      // eslint-disable-next-line jsx-a11y/role-has-required-aria-props
      role="treeitem"
      // aria-selected is provided in selectableEntityProps
      {...selectableEntityProps}
      aria-label={name}
      tabIndex={0}
      translate="no"
    >
      <FileTreeItemInner
        id={id}
        name={name}
        type={type}
        isSelected={isSelected}
        icons={<FileTreeIcon isLinkedFile={isLinkedFile} name={name} />}
      />
    </li>
  )
}

export default FileTreeDoc
