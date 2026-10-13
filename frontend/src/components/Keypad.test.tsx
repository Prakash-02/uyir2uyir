import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Keypad } from './Keypad'

describe('Keypad', () => {
  it('renders buttons for keys 1, 2, and 9 with labels', () => {
    const handlePress = vi.fn()
    render(<Keypad onPressKey={handlePress} />)

    expect(screen.getByRole('button', { name: /Digit 1:/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Digit 2:/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Digit 9:/i })).toBeInTheDocument()
  })

  it('triggers onPressKey with corresponding key when clicked', () => {
    const handlePress = vi.fn()
    render(<Keypad onPressKey={handlePress} />)

    fireEvent.click(screen.getByRole('button', { name: /Digit 1:/i }))
    expect(handlePress).toHaveBeenCalledWith('1')

    fireEvent.click(screen.getByRole('button', { name: /Digit 9:/i }))
    expect(handlePress).toHaveBeenCalledWith('9')
  })

  it('disables all buttons when disabled is true', () => {
    const handlePress = vi.fn()
    render(<Keypad onPressKey={handlePress} disabled />)

    const buttons = screen.getAllByRole('button')
    buttons.forEach((btn) => {
      expect(btn).toBeDisabled()
    })
  })
})
