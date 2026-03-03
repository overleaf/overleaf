import { FC, useMemo } from 'react'
import LoadingSpinner from '@/shared/components/loading-spinner'
import getMeta from '@/utils/meta'
import classNames from 'classnames'
import { useActiveEditorTheme } from '@/shared/hooks/use-active-editor-theme'

export const EditorLoadingPane: FC = () => {
  const editorTheme = useActiveEditorTheme()
  const isDark = useMemo(() => {
    const themes = getMeta('ol-editorThemes') || []
    const legacyThemes = getMeta('ol-legacyEditorThemes') || []
    const selectedTheme =
      themes.find(theme => theme.name === editorTheme) ||
      legacyThemes.find(theme => theme.name === editorTheme)
    return selectedTheme?.dark ?? false
  }, [editorTheme])

  return (
    <div
      className={classNames('loading-panel', { 'loading-panel-dark': isDark })}
    >
      <LoadingSpinner />
    </div>
  )
}
