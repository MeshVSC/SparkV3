import { renderHook, act } from '@testing-library/react'
import { useDebounce } from '@/hooks/use-debounce'

describe('useDebounce hook', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 500))
    
    expect(result.current).toBe('initial')
  })

  it('should debounce value changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 500 }
      }
    )

    expect(result.current).toBe('initial')

    // Change the value
    rerender({ value: 'changed', delay: 500 })

    // Value should still be the old one
    expect(result.current).toBe('initial')

    // Fast forward time but not enough
    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current).toBe('initial')

    // Fast forward enough time
    act(() => {
      vi.advanceTimersByTime(250)
    })

    expect(result.current).toBe('changed')
  })

  it('should reset timer on rapid value changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 500 }
      }
    )

    // Change value multiple times rapidly
    rerender({ value: 'change1', delay: 500 })
    
    act(() => {
      vi.advanceTimersByTime(300)
    })
    
    rerender({ value: 'change2', delay: 500 })
    
    act(() => {
      vi.advanceTimersByTime(300)
    })
    
    rerender({ value: 'final', delay: 500 })

    // Should still have initial value
    expect(result.current).toBe('initial')

    // Fast forward full delay
    act(() => {
      vi.advanceTimersByTime(500)
    })

    // Should now have the final value
    expect(result.current).toBe('final')
  })

  it('should handle different delay values', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 100 }
      }
    )

    rerender({ value: 'changed', delay: 100 })

    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(result.current).toBe('changed')
  })

  it('should work with different types', () => {
    // Test with number
    const { result: numberResult, rerender: numberRerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 0, delay: 500 }
      }
    )

    numberRerender({ value: 42, delay: 500 })
    
    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(numberResult.current).toBe(42)

    // Test with object
    const initialObj = { id: 1, name: 'test' }
    const changedObj = { id: 2, name: 'changed' }

    const { result: objectResult, rerender: objectRerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: initialObj, delay: 500 }
      }
    )

    objectRerender({ value: changedObj, delay: 500 })
    
    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(objectResult.current).toBe(changedObj)
  })
})