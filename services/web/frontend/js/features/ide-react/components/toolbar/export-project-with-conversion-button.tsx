import getMeta from '@/utils/meta'
import { isSplitTestEnabled } from '@/utils/splitTestUtils'
import { FC } from 'react'
import useConvertProject from '../../hooks/use-convert-project'
import { useCommandProvider } from '../../hooks/use-command-provider'
import OLDropdownMenuItem from '@/shared/components/ol/ol-dropdown-menu-item'
import { useRootDoc } from '@/shared/hooks/use-root-doc'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'

type ExportProjectWithConversionProps = {
  featureFlag?: string
  conversionType: 'docx' | 'markdown' | 'html'
  label: string
  menuBarId: string
}
export const ExportProjectWithConversionButton: FC<
  ExportProjectWithConversionProps
> = ({ featureFlag, conversionType, label, menuBarId }) => {
  const splitTestEnabledIfNeeded = featureFlag
    ? isSplitTestEnabled(featureFlag)
    : true
  const enablePandocConversions =
    getMeta('ol-ExposedSettings')?.enablePandocConversions
  const anonymous = getMeta('ol-anonymous')
  const getRootDocInfo = useRootDoc()
  const { openDocs } = useEditorManagerContext()
  const downloadConversion = useConvertProject(
    conversionType,
    openDocs,
    getRootDocInfo
  )

  const showExportButton =
    splitTestEnabledIfNeeded && enablePandocConversions && !anonymous

  useCommandProvider(
    () =>
      showExportButton
        ? [
            {
              id: menuBarId,
              handler: downloadConversion,
              label,
            },
          ]
        : [],
    [showExportButton, downloadConversion, label, menuBarId]
  )

  if (!showExportButton) {
    return null
  }

  return (
    <OLDropdownMenuItem onClick={downloadConversion}>
      {label}
    </OLDropdownMenuItem>
  )
}
