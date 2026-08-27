export default {
  name: '标记',
  langList: [
    { id: 'nomarker', title: '无标记' },
    { id: 'leftarrow', title: '左箭头' },
    { id: 'rightarrow', title: '右箭头' },
    { id: 'textmarker', title: '文本' },
    { id: 'forwardslash', title: '斜杠' },
    { id: 'reverseslash', title: '反斜杠' },
    { id: 'verticalslash', title: '垂直线' },
    { id: 'box', title: '方块' },
    { id: 'star', title: '星形' },
    { id: 'xmark', title: 'X' },
    { id: 'triangle', title: '三角形' },
    { id: 'mcircle', title: '圆形' },
    { id: 'leftarrow_o', title: '左箭头(空心)' },
    { id: 'rightarrow_o', title: '右箭头(空心)' },
    { id: 'box_o', title: '方块(空心)' },
    { id: 'star_o', title: '星形(空心)' },
    { id: 'triangle_o', title: '三角形(空心)' },
    { id: 'mcircle_o', title: '圆形(空心)' }
  ],
  contextTools: [
    {
      title: '起始标记',
      label: 's'
    },
    {
      title: '选择起始标记类型'
    },
    {
      title: '中段标记',
      label: 'm'
    },
    {
      title: '选择中段标记类型'
    },
    {
      title: '末端标记',
      label: 'e'
    },
    {
      title: '选择末端标记类型'
    }
  ]
}
