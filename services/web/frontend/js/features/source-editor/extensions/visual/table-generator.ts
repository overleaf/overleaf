import { EditorView } from '@codemirror/view'

export const tableGeneratorTheme = EditorView.baseTheme({
  '&dark .table-generator': {
    '--table-generator-active-border-color': '#ccc',
    '--table-generator-coming-soon-background-color': '#41464f',
    '--table-generator-coming-soon-color': '#fff',
    '--table-generator-divider-color': 'rgba(125,125,125,0.3)',
    '--table-generator-dropdown-divider-color': 'rgba(125,125,125,0.3)',
    '--table-generator-focus-border-color': '#5d7498',
    '--table-generator-inactive-border-color': '#888',
    '--table-generator-selected-background-color': '#ffffff2a',
    '--table-generator-selector-background-color': '#777',
    '--table-generator-selector-hover-color': '#3265b2',
    '--table-generator-toolbar-background': '#2c3645',
    '--table-generator-toolbar-button-active-background':
      'rgba(125, 125, 125, 0.4)',
    '--table-generator-toolbar-button-color': '#fff',
    '--table-generator-toolbar-button-hover-background':
      'rgba(125, 125, 125, 0.2)',
    '--table-generator-toolbar-dropdown-border-color': 'rgba(125,125,125,0.3)',
    '--table-generator-toolbar-dropdown-disabled-background':
      'rgba(125,125,125,0.3)',
    '--table-generator-toolbar-dropdown-disabled-color': '#999',
    '--table-generator-toolbar-dropdown-active-background': 'var(--green-10)',
    '--table-generator-toolbar-dropdown-active-color': 'var(--green-70)',
    '--table-generator-toolbar-dropdown-active-hover-background':
      'var(--green-10)',
    '--table-generator-toolbar-dropdown-active-active-background':
      'var(--green-20)',
    '--table-generator-toolbar-shadow-color': '#1e253029',
    '--table-generator-error-background': '#2c3645',
    '--table-generator-error-color': '#fff',
    '--table-generator-error-border-color': '#677283',
    '--table-generator-column-size-indicator-background': 'var(--neutral-80)',
    '--table-generator-column-size-indicator-hover-background':
      'var(--neutral-70)',
    '--table-generator-column-size-indicator-color': 'white',
    '--table-generator-column-size-indicator-hover-color': 'white',
  },

  '&light .table-generator': {
    '--table-generator-active-border-color': '#666',
    '--table-generator-coming-soon-background-color': 'var(--neutral-10)',
    '--table-generator-coming-soon-color': 'var(--neutral-70)',
    '--table-generator-divider-color': 'var(--neutral-20)',
    '--table-generator-dropdown-divider-color': 'var(--neutral-20)',
    '--table-generator-focus-border-color': '#97b6e5',
    '--table-generator-inactive-border-color': '#dedede',
    '--table-generator-selected-background-color': 'var(--blue-10)',
    '--table-generator-selector-background-color': 'var(--neutral-30)',
    '--table-generator-selector-hover-color': '#3265b2',
    '--table-generator-toolbar-background': '#fff',
    '--table-generator-toolbar-button-active-background':
      'rgba(47, 58, 76, 0.16)',
    '--table-generator-toolbar-button-color': 'var(--neutral-70)',
    '--table-generator-toolbar-button-hover-background':
      'rgba(47, 58, 76, 0.08)',
    '--table-generator-toolbar-dropdown-border-color': 'var(--neutral-60)',
    '--table-generator-toolbar-dropdown-disabled-background': '#f2f2f2',
    '--table-generator-toolbar-dropdown-disabled-color': 'var(--neutral-40)',
    '--table-generator-toolbar-dropdown-active-background': 'var(--green-10)',
    '--table-generator-toolbar-dropdown-active-color': 'var(--green-70)',
    '--table-generator-toolbar-dropdown-active-hover-background':
      'var(--green-10)',
    '--table-generator-toolbar-dropdown-active-active-background':
      'var(--green-20)',
    '--table-generator-toolbar-shadow-color': '#1e253029',
    '--table-generator-error-background': '#F1F4F9',
    '--table-generator-error-color': 'black',
    '--table-generator-error-border-color': '#C3D0E3',
    '--table-generator-column-size-indicator-background': '#E7E9EE',
    '--table-generator-column-size-indicator-hover-background': '#D7DADF',
    '--table-generator-column-size-indicator-color': 'black',
    '--table-generator-column-size-indicator-hover-color': 'black',
  },

  '.table-generator': {
    position: 'relative',
    '--table-generator-inactive-border-width': '1px',
    '--table-generator-active-border-width': '1px',
    '--table-generator-selector-handle-buffer': '12px',
    '--table-generator-focus-border-width': '2px',
    '--table-generator-focus-negative-border-width': '-2px',
  },

  '.table-generator-cell.selected': {
    'background-color': 'var(--table-generator-selected-background-color)',
  },

  '.table-generator-cell:focus-visible': {
    outline: '2px dotted var(--table-generator-focus-border-color)',
  },

  '.table-generator-cell': {
    border:
      'var(--table-generator-inactive-border-width) dashed var(--table-generator-inactive-border-color)',
    'min-width': '40px',
    height: '30px',
    '&.selection-edge-top': {
      '--shadow-top':
        '0 var(--table-generator-focus-negative-border-width) 0 var(--table-generator-focus-border-color)',
    },
    '&.selection-edge-bottom': {
      '--shadow-bottom':
        '0 var(--table-generator-focus-border-width) 0 var(--table-generator-focus-border-color)',
    },
    '&.selection-edge-left': {
      '--shadow-left':
        'var(--table-generator-focus-negative-border-width) 0 0 var(--table-generator-focus-border-color)',
    },
    '&.selection-edge-right': {
      '--shadow-right':
        'var(--table-generator-focus-border-width) 0 0 var(--table-generator-focus-border-color)',
    },
    'box-shadow':
      'var(--shadow-top, 0 0 0 transparent), var(--shadow-bottom, 0 0 0 transparent), var(--shadow-left, 0 0 0 transparent), var(--shadow-right, 0 0 0 transparent)',
    '&.table-generator-cell-border-left': {
      'border-left-style': 'solid',
      'border-left-color': 'var(--table-generator-active-border-color)',
      'border-left-width': 'var(--table-generator-active-border-width)',
    },

    '&.table-generator-cell-border-right': {
      'border-right-style': 'solid',
      'border-right-color': 'var(--table-generator-active-border-color)',
      'border-right-width': 'var(--table-generator-active-border-width)',
    },

    '&.table-generator-row-border-top': {
      'border-top-style': 'solid',
      'border-top-color': 'var(--table-generator-active-border-color)',
      'border-top-width': 'var(--table-generator-active-border-width)',
    },

    '&.table-generator-row-border-bottom': {
      'border-bottom-style': 'solid',
      'border-bottom-color': 'var(--table-generator-active-border-color)',
      'border-bottom-width': 'var(--table-generator-active-border-width)',
    },
    '& .table-generator-cell-render': {
      'overflow-x': 'auto',
      'overflow-y': 'hidden',
      width: '100%',
    },
  },

  '.table-generator-table': {
    'table-layout': 'fixed',
    width: '95%',
    'max-width': '95%',
    margin: '0 auto',
    cursor: 'default',

    '& td': {
      '&:not(.editing)': {
        padding: '0 0.25em',
      },
      'vertical-align': 'top',

      '&.alignment-left': {
        'text-align': 'left',
      },
      '&.alignment-right': {
        'text-align': 'right',
      },
      '&.alignment-center': {
        'text-align': 'center',
      },
      '&.alignment-paragraph': {
        'text-align': 'justify',
      },
    },

    '& .table-generator-selector-cell': {
      padding: '0',
      border: 'none !important',
      position: 'relative',
      cursor: 'pointer',

      '&.row-selector': {
        width: 'calc(var(--table-generator-selector-handle-buffer) + 8px)',

        '&::after': {
          width: '4px',
          bottom: '4px',
          height: 'calc(100% - 8px)',
        },
      },

      '&.column-selector': {
        height: 'calc(var(--table-generator-selector-handle-buffer) + 8px)',

        '&::after': {
          width: 'calc(100% - 8px)',
          height: '4px',
          right: '4px',
        },
      },

      '&::after': {
        content: '""',
        display: 'block',
        position: 'absolute',
        bottom: '8px',
        right: '8px',
        width: 'calc(100% - 8px)',
        height: 'calc(100% - 8px)',
        'background-color': 'var(--table-generator-selector-background-color)',
        'border-radius': '4px',
      },

      '&:hover::after': {
        'background-color': 'var(--table-generator-selector-hover-color)',
      },

      '&.fully-selected::after': {
        'background-color': 'var(--table-generator-selector-hover-color)',
      },
    },
  },

  '.table-generator-floating-toolbar': {
    position: 'absolute',
    transform: 'translateY(-100%)',
    left: '0',
    right: '0',
    margin: '0 auto',
    // z-index of cursor layer is 150
    'z-index': '152',
    'border-radius': '4px',
    width: 'max-content',
    'justify-content': 'start',
    maxWidth: '100%',
    'background-color': 'var(--table-generator-toolbar-background)',
    'box-shadow': '0px 2px 4px 0px var(--table-generator-toolbar-shadow-color)',
    padding: '4px',
    display: 'flex',
    flexWrap: 'wrap',
    rowGap: '8px',
    '&.table-generator-toolbar-floating-custom-sizes': {
      top: '-8px',
    },
  },

  '.table-generator-toolbar-button': {
    display: 'inline-flex',
    'align-items': 'center',
    'justify-content': 'center',
    margin: '0',
    'background-color': 'transparent',
    border: 'none',
    'border-radius': '4px',
    'line-height': '1',
    overflow: 'hidden',
    color: 'var(--table-generator-toolbar-button-color)',
    'text-align': 'center',
    padding: '4px',

    '&:not(first-child)': {
      'margin-left': '4px',
    },
    '&:not(:last-child)': {
      'margin-right': '4px',
    },

    '& > span': {
      'font-size': '24px',
    },

    '&:hover, &:focus': {
      'background-color':
        'var(--table-generator-toolbar-button-hover-background)',
    },

    '&:active, &.active': {
      'background-color':
        'var(--table-generator-toolbar-button-active-background)',
    },

    '&:hover, &:focus, &:active, &.active': {
      'box-shadow': 'none',
    },

    '&[aria-disabled="true"]': {
      '&:hover, &:focus, &:active, &.active': {
        'background-color': 'transparent',
      },
      opacity: '0.2',
    },
  },

  '.table-generator-button-group': {
    display: 'inline-flex',
    'align-items': 'center',
    'justify-content': 'center',
    'line-height': '1',
    overflow: 'hidden',
    '&:not(:last-child)': {
      'border-right': '1px solid var(--table-generator-divider-color)',
      'padding-right': '8px',
      'margin-right': '8px',
    },
  },

  '.table-generator-button-menu-popover': {
    'background-color': 'var(--table-generator-toolbar-background) !important',
    '& .popover-content, & .popover-body': {
      padding: '4px',
    },
    '& .list-group': {
      margin: '0',
      padding: '0',
    },
    '& > .arrow, & > .popover-arrow': {
      display: 'none',
    },
  },

  '.table-generator-cell-input': {
    color: 'inherit',
    'background-color': 'transparent',
    width: '100%',
    'text-align': 'inherit',
    height: '1.5em',
    'min-height': '100%',
    border: '1px solid var(--table-generator-toolbar-shadow-color)',
    padding: '0 0.25em',
    resize: 'none',
    'box-sizing': 'border-box',
    overflow: 'hidden',
    '&:focus, &:focus-visible': {
      outline: '2px solid var(--table-generator-focus-border-color)',
      'outline-offset': '-2px',
    },
  },

  '.table-generator-border-options-coming-soon': {
    display: 'flex',
    margin: '4px',
    'font-size': '12px',
    background: 'var(--table-generator-coming-soon-background-color)',
    color: 'var(--table-generator-coming-soon-color)',
    padding: '8px',
    gap: '6px',
    'align-items': 'flex-start',
    'max-width': '240px',
    'font-family': 'var(--bs-body-font-family)',

    '& .info-icon': {
      flex: ' 0 0 24px',
    },
  },

  '.table-generator-toolbar-dropdown-toggle': {
    border: '1px solid var(--table-generator-toolbar-dropdown-border-color)',
    'box-shadow': 'none',
    background: 'transparent',
    'white-space': 'nowrap',
    color: 'var(--table-generator-toolbar-button-color)',
    'border-radius': '4px',
    padding: '6px 8px',
    gap: '8px',
    'min-width': '120px',
    'font-size': '14px',
    display: 'flex',
    'align-items': 'center',
    'justify-content': 'space-between',
    'font-family': 'var(--bs-body-font-family)',
    height: '36px',

    '&:not(:first-child)': {
      'margin-left': '8px',
    },

    '&[aria-disabled="true"]': {
      'background-color':
        'var(--table-generator-toolbar-dropdown-disabled-background)',
      color: 'var(--table-generator-toolbar-dropdown-disabled-color)',
    },
  },

  '.table-generator-toolbar-dropdown-popover': {
    'max-width': '300px',
    background: 'var(--table-generator-toolbar-background) !important',

    '& .popover-content, & .popover-body': {
      padding: '0',
    },

    '& > .arrow, & > .popover-arrow': {
      display: 'none',
    },
  },

  '.table-generator-toolbar-dropdown-menu': {
    display: 'flex',
    'flex-direction': 'column',
    'min-width': '200px',
    padding: '4px',

    '& > button': {
      border: 'none',
      'box-shadow': 'none',
      background: 'transparent',
      'white-space': 'nowrap',
      color: 'var(--table-generator-toolbar-button-color)',
      'border-radius': '4px',
      'font-size': '14px',
      display: 'flex',
      'align-items': 'center',
      'justify-content': 'flex-start',
      'column-gap': '8px',
      'align-self': 'stretch',
      padding: '12px 8px',
      'font-family': 'var(--bs-body-font-family)',

      '& .table-generator-button-label': {
        'align-self': 'stretch',
        flex: '1 0 auto',
        'text-align': 'left',
      },

      '&.ol-cm-toolbar-dropdown-option-active': {
        'background-color':
          'var(--table-generator-toolbar-dropdown-active-background)',
        color: 'var(--table-generator-toolbar-dropdown-active-color)',
      },

      '&:hover, &:focus': {
        'background-color':
          'var(--table-generator-toolbar-button-hover-background)',
      },

      '&:active, &.active': {
        'background-color':
          'var(--table-generator-toolbar-button-active-background)',
      },

      '&.ol-cm-toolbar-dropdown-option-active:hover, &.ol-cm-toolbar-dropdown-option-active:focus':
        {
          'background-color':
            'var(--table-generator-toolbar-dropdown-active-hover-background)',
        },

      '&.ol-cm-toolbar-dropdown-option-active:active, &.ol-cm-toolbar-dropdown-option-active.active':
        {
          'background-color':
            'var(--table-generator-toolbar-dropdown-active-active-background)',
        },

      '&:hover, &:focus, &:active, &.active': {
        'box-shadow': 'none',
      },

      '&[aria-disabled="true"]': {
        '&:hover, &:focus, &:active, &.active': {
          'background-color': 'transparent',
        },
        color: 'var(--table-generator-toolbar-dropdown-disabled-color)',
      },
    },

    '& > hr': {
      background: 'var(--table-generator-dropdown-divider-color)',
      margin: '2px 8px',
      display: 'block',
      'box-sizing': 'content-box',
      border: '0',
      height: '1px',
    },

    '& .ol-cm-toolbar-dropdown-option-content': {
      textAlign: 'left',
      flexGrow: '1',
    },
  },

  '.ol-cm-environment-table.table-generator-error-container, .ol-cm-environment-table.ol-cm-tabular':
    {
      background: 'rgba(125, 125, 125, 0.05)',
      'font-family': 'var(--bs-body-font-family)',
    },

  '.table-generator-filler-row': {
    border: 'none !important',
    '& td': {
      'min-width': '40px',
    },
  },

  '.table-generator-column-indicator-button': {
    verticalAlign: 'middle',
    borderRadius: '4px',
    padding: '2px 4px 2px 4px',
    background: 'var(--table-generator-column-size-indicator-background)',
    margin: 0,
    border: 'none',
    fontFamily: 'Lato, sans-serif',
    fontSize: '12px',
    lineHeight: '16px',
    fontWeight: 400,
    display: 'flex',
    maxWidth: '100%',
    color: 'var(--table-generator-column-size-indicator-color)',

    '&:hover': {
      background:
        'var(--table-generator-column-size-indicator-hover-background)',
      color: 'var(--table-generator-column-size-indicator-hover-color)',
    },

    '& .table-generator-column-indicator-icon': {
      fontSize: '16px',
      lineHeight: '16px',
    },

    '& .table-generator-column-indicator-label': {
      textOverflow: 'ellipsis',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
    },
  },
  '.table-generator-column-widths-row': {
    height: '20px',
    '& td': {
      lineHeight: '1',
    },
  },
})
