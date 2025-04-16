import {
  Command,
  useCommandRegistry,
} from '@/features/ide-react/context/command-registry-context'
import {
  DropdownDivider,
  DropdownHeader,
} from '@/features/ui/components/bootstrap-5/dropdown-menu'
import {
  MenuBarDropdown,
  NestedMenuBarDropdown,
} from '@/shared/components/menu-bar/menu-bar-dropdown'
import { MenuBarOption } from '@/shared/components/menu-bar/menu-bar-option'
import { Fragment, useCallback, useMemo } from 'react'

type CommandId = string
type TaggedCommand = Command & { type: 'command' }
type Entry<T> = T | GroupStructure<T>
type GroupStructure<T> = {
  id: string
  title: string
  children: Array<Entry<T>>
}
export type MenuSectionStructure<T = CommandId> = {
  title?: string
  id: string
  children: Array<Entry<T>>
}
export type MenuStructure<T = CommandId> = Array<MenuSectionStructure<T>>

const CommandDropdown = ({
  menu,
  title,
  id,
}: {
  menu: MenuStructure<CommandId>
  title: string
  id: string
}) => {
  const { registry } = useCommandRegistry()
  const populatedSections = useMemo(
    () =>
      menu
        .map(section => populateSectionOrGroup(section, registry))
        .filter(x => x.children.length > 0),
    [menu, registry]
  )

  if (populatedSections.length === 0) {
    return null
  }

  return (
    <MenuBarDropdown
      title={title}
      id={id}
      className="ide-redesign-toolbar-dropdown-toggle-subdued ide-redesign-toolbar-button-subdued"
    >
      {populatedSections.map((section, index) => {
        return (
          <Fragment key={section.id}>
            {index > 0 && <DropdownDivider />}
            {section.title && <DropdownHeader>{section.title}</DropdownHeader>}
            {section.children.map(child => (
              <CommandDropdownChild item={child} key={child.id} />
            ))}
          </Fragment>
        )
      })}
    </MenuBarDropdown>
  )
}

export const CommandSection = ({
  section: sectionStructure,
}: {
  section: MenuSectionStructure<CommandId>
}) => {
  const { registry } = useCommandRegistry()
  const section = populateSectionOrGroup(sectionStructure, registry)
  if (section.children.length === 0) {
    return null
  }
  return (
    <>
      {section.title && <DropdownHeader>{section.title}</DropdownHeader>}
      {section.children.map(child => (
        <CommandDropdownChild item={child} key={child.id} />
      ))}
    </>
  )
}

const CommandDropdownChild = ({ item }: { item: Entry<TaggedCommand> }) => {
  const onClickHandler = useCallback(() => {
    if (isTaggedCommand(item)) {
      item.handler?.({ location: 'menu-bar' })
    }
  }, [item])

  if (isTaggedCommand(item)) {
    return (
      <MenuBarOption
        key={item.id}
        title={item.label}
        // eslint-disable-next-line react/jsx-handler-names
        onClick={onClickHandler}
        href={item.href}
        disabled={item.disabled}
      />
    )
  } else {
    return (
      <NestedMenuBarDropdown title={item.title} id={item.id} key={item.id}>
        {item.children.map(subChild => {
          return <CommandDropdownChild item={subChild} key={subChild.id} />
        })}
      </NestedMenuBarDropdown>
    )
  }
}

export default CommandDropdown

function populateSectionOrGroup<
  T extends { children: Array<Entry<CommandId>> },
>(
  section: T,
  registry: Map<string, Command>
): Omit<T, 'children'> & {
  children: Array<Entry<TaggedCommand>>
} {
  const { children, ...rest } = section
  return {
    ...rest,
    children: children
      .map(child => {
        if (typeof child !== 'string') {
          const populatedChild = populateSectionOrGroup(child, registry)
          if (populatedChild.children.length === 0) {
            // Skip empty groups
            return undefined
          }
          return populatedChild
        }
        const command = registry.get(child)
        if (command) {
          return { ...command, type: 'command' as const }
        }
        return undefined
      })
      .filter(x => x !== undefined),
  }
}

function isTaggedCommand(item: Entry<TaggedCommand>): item is TaggedCommand {
  return 'type' in item && item.type === 'command'
}
