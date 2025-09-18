import { cn } from '@/lib/utils'

describe('cn utility function', () => {
  it('merges class names correctly', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1')
  })

  it('handles conditional classes', () => {
    expect(cn('base-class', true && 'conditional-class')).toBe('base-class conditional-class')
    expect(cn('base-class', false && 'conditional-class')).toBe('base-class')
  })

  it('merges Tailwind classes correctly', () => {
    // Should merge conflicting Tailwind classes, keeping the last one
    expect(cn('px-2', 'px-4')).toBe('px-4')
    expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500')
  })

  it('handles arrays of classes', () => {
    expect(cn(['px-2', 'py-1'], 'bg-white')).toBe('px-2 py-1 bg-white')
  })

  it('handles objects with conditional classes', () => {
    expect(cn({
      'base-class': true,
      'conditional-true': true,
      'conditional-false': false,
    })).toBe('base-class conditional-true')
  })

  it('handles mixed inputs', () => {
    expect(cn(
      'base-class',
      ['array-class-1', 'array-class-2'],
      {
        'object-class': true,
        'false-class': false,
      },
      true && 'conditional-class'
    )).toBe('base-class array-class-1 array-class-2 object-class conditional-class')
  })

  it('handles undefined and null values', () => {
    expect(cn('base-class', undefined, null, 'other-class')).toBe('base-class other-class')
  })

  it('returns empty string for no valid inputs', () => {
    expect(cn()).toBe('')
    expect(cn(undefined, null, false)).toBe('')
  })
})