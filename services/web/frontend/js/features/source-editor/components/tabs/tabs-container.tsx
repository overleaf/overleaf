import { useFileTreeOpenContext } from '@/features/ide-react/context/file-tree-open-context'
import { useTabsContext } from '@/features/ide-react/context/tabs-context'
import { Tab } from './tab'

export const TabsContainer = () => {
  const { tabs, openTab, closeTab, moveTab, makeTabPermanent } =
    useTabsContext()
  const { openEntity } = useFileTreeOpenContext()

  return (
    <div className="editor-tabs-container" role="tablist">
      {tabs.map(tab => (
        <Tab
          key={tab.id}
          tab={tab}
          openTab={openTab}
          closeTab={closeTab}
          isSelected={openEntity?.entity._id === tab.id}
          onTabDrop={moveTab}
          makeTabPermanent={makeTabPermanent}
        />
      ))}
    </div>
  )
}
