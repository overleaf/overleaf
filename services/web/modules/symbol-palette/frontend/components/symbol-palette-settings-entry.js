import SymbolPaletteSettings from './symbol-palette-settings'
import { SymbolPaletteConfigProvider } from '../context/symbol-palette-context'

function SymbolPaletteSettingsWrapper() {
    return (
        <SymbolPaletteConfigProvider>
            <SymbolPaletteSettings />
        </SymbolPaletteConfigProvider>
    )
}

const symbolPaletteSettingsEntry = {
    key: 'symbol-palette',
    title: 'Symbol Palette',
    icon: 'functions',
    sections: [
        {
            key: 'symbol-palette-config',
            settings: [
                {
                    key: 'symbol-palette-settings',
                    component: <SymbolPaletteSettingsWrapper />,
                },
            ],
        },
    ],
}

export default symbolPaletteSettingsEntry
