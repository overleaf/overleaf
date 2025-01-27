import { useTranslation } from 'react-i18next'
import Icon from '../../../shared/components/icon'
import iconTypeFromName, {
  newEditorIconTypeFromName,
} from '../util/icon-type-from-name'
import classnames from 'classnames'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import MaterialIcon from '@/shared/components/material-icon'
import { useFeatureFlag } from '@/shared/context/split-test-context'

function FileTreeIcon({
  isLinkedFile,
  name,
}: {
  name: string
  isLinkedFile?: boolean
}) {
  const { t } = useTranslation()

  const className = classnames('file-tree-icon', {
    'linked-file-icon': isLinkedFile,
  })

  const newEditor = useFeatureFlag('editor-redesign')

  if (newEditor) {
    return (
      <>
        <MaterialIcon
          unfilled
          type={newEditorIconTypeFromName(name)}
          className={className}
        />
        {isLinkedFile && (
          <MaterialIcon
            type="open_in_new"
            modifier="rotate-180"
            className="linked-file-highlight"
            accessibilityLabel={t('linked_file')}
          />
        )}
      </>
    )
  }

  return (
    <>
      &nbsp;
      <BootstrapVersionSwitcher
        bs3={
          <>
            <Icon type={iconTypeFromName(name)} fw className={className} />
            {isLinkedFile && (
              <Icon
                type="external-link-square"
                modifier="rotate-180"
                className="linked-file-highlight"
                accessibilityLabel={t('linked_file')}
              />
            )}
          </>
        }
        bs5={
          <>
            <MaterialIcon type={iconTypeFromName(name)} className={className} />
            {isLinkedFile && (
              <MaterialIcon
                type="open_in_new"
                modifier="rotate-180"
                className="linked-file-highlight"
                accessibilityLabel={t('linked_file')}
              />
            )}
          </>
        }
      />
    </>
  )
}

export default FileTreeIcon
