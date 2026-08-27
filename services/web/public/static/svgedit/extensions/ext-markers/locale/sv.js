export default {
  name: 'Markörer',
  langList: [
    { id: 'nomarker', title: 'Ingen markör' },
    { id: 'leftarrow', title: 'Vänster pil' },
    { id: 'rightarrow', title: 'Höger pil' },
    { id: 'textmarker', title: 'Textmarkör' },
    { id: 'forwardslash', title: 'Snedstreck' },
    { id: 'reverseslash', title: 'Omvänd snedstreck' },
    { id: 'verticalslash', title: 'Vertikal snedstreck' },
    { id: 'box', title: 'Låda' },
    { id: 'star', title: 'Stjärna' },
    { id: 'xmark', title: 'X' },
    { id: 'triangle', title: 'Triangel' },
    { id: 'mcircle', title: 'Cirkel' },
    { id: 'leftarrow_o', title: 'Öppna vänsterpilen' },
    { id: 'rightarrow_o', title: 'Öppna högerpil' },
    { id: 'box_o', title: 'Öppen låda' },
    { id: 'star_o', title: 'Öppna Stjärna' },
    { id: 'triangle_o', title: 'Öppna triangeln' },
    { id: 'mcircle_o', title: 'Öppna cirkeln' }
  ],
  contextTools: [
    {
      title: 'Startmarkör',
      label: 's'
    },
    {
      title: 'Välj typ av startmarkör'
    },
    {
      title: 'Mellanmarkör',
      label: 'm'
    },
    {
      title: 'Välj mellanmarkeringstyp'
    },
    {
      title: 'Slutmarkör',
      label: 'e'
    },
    {
      title: 'Välj typ av slutmarkör'
    }
  ]
}
