export const prefix = '___';
export default {
  standard: prefix + 'standardDecode',
  chart: prefix + 'chartDecode',
  atob: {
    getter: prefix + 'atobGetter1',
    getter2: prefix + 'atobGetter2',
    call: prefix + 'atobCall',
    wrapper: prefix + 'atobWrapper',
    poly: prefix + 'atobPolyfill',
  },
};
