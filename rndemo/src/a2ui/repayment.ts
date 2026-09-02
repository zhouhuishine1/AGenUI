const options = [
  {id: 'opt1', type: 'full', icon: 'payment'},
  {id: 'opt2', type: 'minimum', icon: 'event'},
  {id: 'opt3', type: 'custom', icon: 'edit'},
] as const;

const optionComponents = options.flatMap(option => [
  {id: `${option.id}_card`, component: 'Card', child: `${option.id}_row`, styles: option.id === 'opt3' ? undefined : {margin: '0px 0px 12px 0px'}},
  {id: `${option.id}_row`, component: 'Row', justify: 'spaceBetween', align: 'center', children: [`${option.id}_left_row`, `${option.id}_btn`], styles: {'background-color': '#FFFFFF', 'border-radius': '16px', padding: '16px 16px 16px 16px', width: '100%', 'justify-content': 'space-between'}},
  {id: `${option.id}_left_row`, component: 'Row', align: 'center', children: [`${option.id}_icon`, `${option.id}_info`], styles: {'flex-grow': 1}},
  {id: `${option.id}_icon`, component: 'Icon', name: option.icon, styles: {margin: '0px 12px 0px 0px'}},
  {id: `${option.id}_info`, component: 'Column', children: [`${option.id}_title`, `${option.id}_sub`]},
  {id: `${option.id}_title`, component: 'Text', text: {path: `/repayment/${option.id}/title`}, variant: 'h4', styles: {'font-size': '32px', 'font-weight': 'bold', color: '#1D2129'}},
  {id: `${option.id}_sub`, component: 'Text', text: {path: `/repayment/${option.id}/sub`}, variant: 'caption', styles: {'font-size': '26px', color: '#86909C', margin: '4px 0px 0px 0px'}},
  {id: `${option.id}_btn`, component: 'Button', child: `${option.id}_btn_text`, variant: 'primary', action: {functionCall: {call: 'selectRepayOption', args: {type: option.type}}}, styles: {'background-color': '#FFF0E6', 'border-color': '#FF6B00', 'border-style': 'solid', 'border-width': '1px', 'border-radius': '20px', padding: '8px 20px 8px 20px', 'flex-shrink': 0}},
  {id: `${option.id}_btn_text`, component: 'Text', text: {path: `/repayment/${option.id}/btnText`}, styles: {color: '#FF6B00', 'font-weight': 'bold', 'font-size': '28px'}},
]);

export const repaymentComponents = {version: 'v0.9', updateComponents: {surfaceId: 'repayment_card', components: [
  {id: 'root', component: 'Card', child: 'main_column'},
  {id: 'main_column', component: 'Column', children: ['bill_summary', 'bill_details', 'prompt_text', 'options_column'], styles: {'background-color': '#FAF7F5', 'border-radius': '24px', padding: '20px 20px 20px 20px'}},
  {id: 'bill_summary', component: 'Text', text: {path: '/repayment/billSummary'}, variant: 'h3', styles: {'font-size': '32px', 'font-weight': 'bold', color: '#1D2129', 'line-height': 1.4}},
  {id: 'bill_details', component: 'Text', text: {path: '/repayment/billDetails'}, variant: 'body', styles: {'font-size': '28px', color: '#4E5969', margin: '6px 0px 16px 0px', 'line-height': 1.4}},
  {id: 'prompt_text', component: 'Text', text: {path: '/repayment/prompt'}, variant: 'h4', styles: {'font-size': '32px', 'font-weight': 'bold', color: '#1D2129', margin: '0px 0px 16px 0px'}},
  {id: 'options_column', component: 'Column', children: options.map(option => `${option.id}_card`)},
  ...optionComponents,
]}};

export const repaymentDataModel = {version: 'v0.9', updateDataModel: {surfaceId: 'repayment_card', path: '/repayment', value: {
  billSummary: '您本期信用卡账单【尚未还清】', billDetails: '剩余待还金额 ¥ 6270.31 ，还款日 8-16', prompt: '我可以帮您',
  opt1: {title: '还清账单', sub: '还 ¥ 6270.31', btnText: '选它'}, opt2: {title: '先还最低', sub: '还 ¥ 313.52 ，不影响征信', btnText: '选它'}, opt3: {title: '自定义还款金额', sub: '请告诉我具体的还款金额', btnText: '选它'},
}}};
