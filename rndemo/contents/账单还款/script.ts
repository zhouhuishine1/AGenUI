export type RepayOption = 'full' | 'minimum' | 'custom';

export function handleSelectRepayOption(type: RepayOption) {
  return type === 'full' ? '已选择全量还款' : type === 'minimum' ? '已选择先还最低' : '已选择自定义还款';
}
