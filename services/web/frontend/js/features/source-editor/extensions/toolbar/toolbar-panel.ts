import { StateEffect, StateField } from '@codemirror/state'
import { EditorView, showPanel } from '@codemirror/view'

const toggleToolbarEffect = StateEffect.define<boolean>()
const toolbarState = StateField.define<boolean>({
  create: () => true,
  update: (value, tr) => {
    if (tr.state.readOnly) {
      return false
    }
    for (const effect of tr.effects) {
      if (effect.is(toggleToolbarEffect)) {
        value = effect.value
      }
    }
    return value
  },
  provide: f => showPanel.from(f, on => (on ? createToolbarPanel : null)),
})

export function createToolbarPanel() {
  const dom = document.createElement('div')
  dom.classList.add('ol-cm-toolbar-portal')
  return { dom, top: true }
}

export const toolbarPanel = () => [
  toolbarState,
  EditorView.theme({
    '.ol-cm-toolbar': {
      backgroundColor: 'var(--editor-toolbar-bg)',
      color: 'var(--toolbar-btn-color)',
      flex: 1,
      display: 'flex',
      overflowX: 'hidden',
    },
    '&.overall-theme-dark .ol-cm-toolbar': {
      '& img': {
        filter: 'invert(1)',
      },
    },
    '.ol-cm-toolbar-overflow': {
      display: 'flex',
      flexWrap: 'wrap',
    },
    '#popover-toolbar-overflow': {
      padding: 0,
      borderColor: 'rgba(125, 125, 125, 0.2)',
      backgroundColor: 'var(--editor-toolbar-bg)',
      color: 'var(--toolbar-btn-color)',
      '& .popover-content': {
        padding: 0,
      },
      '& .arrow': {
        borderBottomColor: 'rgba(125, 125, 125, 0.2)',
        '&:after': {
          borderBottomColor: 'var(--editor-toolbar-bg)',
        },
      },
    },
    '.ol-cm-toolbar-button-menu-popover': {
      '& > .popover-content': {
        padding: 0,
      },
      '& .arrow': {
        display: 'none',
      },
      '& .list-group': {
        marginBottom: 0,
      },
      '& .list-group-item': {
        width: '100%',
        textAlign: 'start',
      },
    },
    '.ol-cm-toolbar-button-group': {
      display: 'flex',
      alignItems: 'center',
      whiteSpace: 'nowrap',
      flexWrap: 'nowrap',
      padding: '0 4px',
      margin: '4px 0',
      lineHeight: '1',
      '&:not(:first-of-type)': {
        borderLeft: '1px solid rgba(125, 125, 125, 0.3)',
        '&.ol-cm-toolbar-end': {
          borderLeft: 'none',
        },
        '&.overflow-hidden': {
          borderLeft: 'none',
        },
      },
      '&.overflow-hidden': {
        width: 0,
        padding: 0,
      },
    },
    '.ol-cm-toolbar-button': {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0',
      margin: '0 1px',
      backgroundColor: 'transparent',
      border: 'none',
      borderRadius: '1px',
      lineHeight: '1',
      width: '24px',
      height: '24px',
      overflow: 'hidden',
      '&:hover, &:focus, &:active, &.active': {
        backgroundColor: 'rgba(125, 125, 125, 0.1)',
        color: 'inherit',
        boxShadow: 'none',
        '&[disabled]': {
          opacity: '0.2',
        },
      },
      '&.active, &:active': {
        backgroundColor: 'rgba(125, 125, 125, 0.2)',
      },
      '&[disabled]': {
        opacity: '0.2',
      },
      '.overflow-hidden &': {
        display: 'none',
      },
      '&.ol-cm-toolbar-button-math': {
        fontFamily: '"Noto Serif", serif',
        fontSize: '16px',
        fontWeight: 700,
      },
    },
    '&.overall-theme-dark .ol-cm-toolbar-button': {
      opacity: 0.8,
      '&:hover, &:focus, &:active, &.active': {
        backgroundColor: 'rgba(125, 125, 125, 0.2)',
      },
      '&.active, &:active': {
        backgroundColor: 'rgba(125, 125, 125, 0.4)',
      },
      '&[disabled]': {
        opacity: 0.2,
      },
    },
    '.ol-cm-toolbar-end': {
      flex: 1,
      justifyContent: 'flex-end',
    },
    '.ol-cm-toolbar-overflow-toggle': {
      display: 'none',
      '&.ol-cm-toolbar-overflow-toggle-visible': {
        display: 'flex',
      },
    },
    '.ol-cm-toolbar-menu-toggle': {
      background: 'transparent',
      boxShadow: 'none !important',
      border: 'none',
      whiteSpace: 'nowrap',
      color: 'inherit',
      borderRadius: '0',
      opacity: 0.8,
      width: '120px',
      fontSize: '13px',
      fontFamily: 'Lato',
      fontWeight: '700',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '5px 6px',
      '&:hover, &:focus, &.active': {
        backgroundColor: 'rgba(125, 125, 125, 0.1)',
        opacity: '1',
        color: 'inherit',
      },
      '& .caret': {
        marginTop: '0',
      },
    },
    '.ol-cm-toolbar-menu-popover': {
      border: 'none',
      borderRadius: '0',
      borderBottomLeftRadius: '4px',
      borderBottomRightRadius: '4px',
      boxShadow: '0 2px 5px rgb(0 0 0 / 20%)',
      backgroundColor: 'var(--editor-toolbar-bg)',
      color: 'var(--toolbar-btn-color)',
      padding: '0',
      '&.bottom': {
        marginTop: '1px',
      },
      '&.top': {
        marginBottom: '1px',
      },
      '& .arrow': {
        display: 'none',
      },
      '& .popover-content': {
        padding: '0',
      },
      '& .ol-cm-toolbar-menu': {
        width: '120px',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        fontSize: '14px',
      },
      '& .ol-cm-toolbar-menu-item': {
        border: 'none',
        background: 'none',
        padding: '4px 12px',
        height: '40px',
        display: 'flex',
        alignItems: 'center',
        fontWeight: 'bold',
        '&.ol-cm-toolbar-menu-item-active': {
          backgroundColor: 'rgba(125, 125, 125, 0.1)',
        },
        '&:hover': {
          backgroundColor: 'rgba(125, 125, 125, 0.2)',
          color: 'inherit',
        },
        '&.section-level-section': {
          fontSize: '1.44em',
        },
        '&.section-level-subsection': {
          fontSize: '1.2em',
        },
        '&.section-level-body': {
          fontWeight: 'normal',
        },
      },
    },
  }),
]
