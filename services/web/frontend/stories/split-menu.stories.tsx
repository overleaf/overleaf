import SplitMenu from '../js/shared/components/split-menu'

export const PrimaryWithoutTooltip = () => {
  return (
    <SplitMenu
      bsStyle="primary"
      button={{
        text: 'Button',
      }}
      dropdown={{
        id: 'pdf-recompile-dropdown',
      }}
    >
      <SplitMenu.Item>tes</SplitMenu.Item>
    </SplitMenu>
  )
}

export const PrimaryWithTooltip = () => {
  return (
    <SplitMenu
      bsStyle="primary"
      button={{
        text: 'Button',
        tooltip: {
          description: 'tooltip description',
          id: 'tooltip-storybook',
          overlayProps: {
            placement: 'bottom',
          },
        },
      }}
      dropdown={{
        id: 'pdf-recompile-dropdown',
      }}
    >
      <SplitMenu.Item>tes</SplitMenu.Item>
    </SplitMenu>
  )
}

export const Disabled = () => {
  return (
    <div>
      <h2>Primary</h2>
      <SplitMenu
        bsStyle="primary"
        disabled
        button={{
          text: 'Button',
        }}
        dropdown={{
          id: 'pdf-recompile-dropdown',
        }}
        dropdownToggle={{}}
      >
        <SplitMenu.Item>tes</SplitMenu.Item>
      </SplitMenu>
      <hr />
      <h2>Secondary</h2>
      <SplitMenu
        bsStyle="secondary"
        disabled
        button={{
          text: 'Button',
        }}
        dropdown={{
          id: 'pdf-recompile-dropdown',
        }}
        dropdownToggle={{}}
      >
        <SplitMenu.Item>tes</SplitMenu.Item>
      </SplitMenu>
      <hr />
      <h2>Danger</h2>
      <SplitMenu
        bsStyle="danger"
        disabled
        button={{
          text: 'Button',
        }}
        dropdown={{
          id: 'pdf-recompile-dropdown',
        }}
        dropdownToggle={{}}
      >
        <SplitMenu.Item>tes</SplitMenu.Item>
      </SplitMenu>
    </div>
  )
}

export const DifferentSizeAndStyle = () => {
  return (
    <div>
      <h2>Default (medium)</h2>
      <div style={{ display: 'flex', gap: '10px' }}>
        <SplitMenu
          bsStyle="primary"
          bsSize="md"
          button={{
            text: 'Button',
          }}
          dropdown={{
            id: 'pdf-recompile-dropdown',
          }}
        >
          <SplitMenu.Item>tes</SplitMenu.Item>
        </SplitMenu>
        <SplitMenu
          bsStyle="secondary"
          bsSize="md"
          button={{
            text: 'Button',
          }}
          dropdown={{
            id: 'pdf-recompile-dropdown',
          }}
        >
          <SplitMenu.Item>tes</SplitMenu.Item>
        </SplitMenu>
        <SplitMenu
          bsStyle="danger"
          bsSize="md"
          button={{
            text: 'Button',
          }}
          dropdown={{
            id: 'pdf-recompile-dropdown',
          }}
        >
          <SplitMenu.Item>tes</SplitMenu.Item>
        </SplitMenu>
      </div>
      <hr />
      <h2>Small</h2>
      <div style={{ display: 'flex', gap: '10px' }}>
        <SplitMenu
          bsStyle="primary"
          bsSize="sm"
          button={{
            text: 'Button',
          }}
          dropdown={{
            id: 'pdf-recompile-dropdown',
          }}
        >
          <SplitMenu.Item>tes</SplitMenu.Item>
        </SplitMenu>
        <SplitMenu
          bsStyle="secondary"
          bsSize="sm"
          button={{
            text: 'Button',
          }}
          dropdown={{
            id: 'pdf-recompile-dropdown',
          }}
        >
          <SplitMenu.Item>tes</SplitMenu.Item>
        </SplitMenu>
        <SplitMenu
          bsStyle="danger"
          bsSize="sm"
          button={{
            text: 'Button',
          }}
          dropdown={{
            id: 'pdf-recompile-dropdown',
          }}
        >
          <SplitMenu.Item>tes</SplitMenu.Item>
        </SplitMenu>
      </div>
      <hr />
      <h2>Extra Small</h2>
      <div style={{ display: 'flex', gap: '10px' }}>
        <SplitMenu
          bsStyle="primary"
          bsSize="xs"
          button={{
            text: 'Button',
          }}
          dropdown={{
            id: 'pdf-recompile-dropdown',
          }}
        >
          <SplitMenu.Item>tes</SplitMenu.Item>
        </SplitMenu>
        <SplitMenu
          bsStyle="secondary"
          bsSize="xs"
          button={{
            text: 'Button',
          }}
          dropdown={{
            id: 'pdf-recompile-dropdown',
          }}
        >
          <SplitMenu.Item>tes</SplitMenu.Item>
        </SplitMenu>
        <SplitMenu
          bsStyle="danger"
          bsSize="xs"
          button={{
            text: 'Button',
          }}
          dropdown={{
            id: 'pdf-recompile-dropdown',
          }}
        >
          <SplitMenu.Item>tes</SplitMenu.Item>
        </SplitMenu>
      </div>
    </div>
  )
}

export default {
  title: 'Shared / Components / Split Menu',
  component: SplitMenu,
  args: {
    source: 'storybook',
  },
}
