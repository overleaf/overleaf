export default {
  name: 'Маркери',
  langList: [
    { id: 'nomarker', title: 'Без маркеру' },
    { id: 'leftarrow', title: 'Ліва Стрілка' },
    { id: 'rightarrow', title: 'Права Стрілка' },
    { id: 'textmarker', title: 'Текстовий Маркер' },
    { id: 'forwardslash', title: 'Слеш вперед' },
    { id: 'reverseslash', title: 'Слеш назад' },
    { id: 'verticalslash', title: 'Вертикальний слеш' },
    { id: 'box', title: 'Коробка' },
    { id: 'star', title: 'Зірка' },
    { id: 'xmark', title: 'X' },
    { id: 'triangle', title: 'Трикутник' },
    { id: 'mcircle', title: 'Коло' },
    { id: 'leftarrow_o', title: 'Пуста Ліва Стрілка' },
    { id: 'rightarrow_o', title: 'Пуста Права Стрілка' },
    { id: 'box_o', title: 'Пуста Коробка' },
    { id: 'star_o', title: 'Пуста Зірка' },
    { id: 'triangle_o', title: 'Пустий Трикутний' },
    { id: 'mcircle_o', title: 'Пусте Коло' }
  ],
  contextTools: [
    {
      title: 'Початковий маркер',
      label: 's'
    },
    {
      title: 'Оберіть тип початковий маркеру'
    },
    {
      title: 'Середній маркер',
      label: 'm'
    },
    {
      title: 'Оберіть тип середнього маркеру'
    },
    {
      title: 'Кінцевий маркер',
      label: 'e'
    },
    {
      title: 'Оберіть тип кінцевого маркеру'
    }
  ]
}
