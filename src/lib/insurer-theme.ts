export const insurerAccents = {
  blue: { label: 'Bleu', primary: '#397FBD', light: '#EAF4FE', active: '#1B4776', icon: '#83C1F7' },
  indigo: { label: 'Indigo', primary: '#6155B8', light: '#EFEDFF', active: '#403A80', icon: '#B9B3FF' },
  teal: { label: 'Turquoise', primary: '#168A91', light: '#E4F5F5', active: '#155D68', icon: '#8EE1DE' },
  green: { label: 'Vert', primary: '#21865B', light: '#E8F5EC', active: '#1B6045', icon: '#93D1AA' },
  violet: { label: 'Violet', primary: '#8057A6', light: '#F3ECF8', active: '#593D74', icon: '#D2B8E8' },
  slate: { label: 'Ardoise', primary: '#65788B', light: '#EDF1F5', active: '#43566A', icon: '#B6C5D3' },
} as const;

export type InsurerAccent = keyof typeof insurerAccents;

export function isInsurerAccent(value: string): value is InsurerAccent {
  return value in insurerAccents;
}
