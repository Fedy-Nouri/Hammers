import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import ChatInput from './ChatInput'

function renderInput(disabled = false) {
  const onSend = vi.fn()
  render(<ChatInput onSend={onSend} disabled={disabled} />)
  // Query by role so it resolves regardless of the disabled-state placeholder change.
  const textarea = screen.getByRole('textbox')
  return { onSend, textarea }
}

describe('ChatInput', () => {
  it('does not call onSend for an empty / whitespace-only message', () => {
    const { onSend, textarea } = renderInput()
    fireEvent.change(textarea, { target: { value: '   ' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(onSend).not.toHaveBeenCalled()
  })

  it('sends the trimmed text on Enter and clears the field', () => {
    const { onSend, textarea } = renderInput()
    fireEvent.change(textarea, { target: { value: '  hello world  ' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(onSend).toHaveBeenCalledWith('hello world', [])
    expect((textarea as HTMLTextAreaElement).value).toBe('')
  })

  it('inserts a newline instead of sending on Shift+Enter', () => {
    const { onSend, textarea } = renderInput()
    fireEvent.change(textarea, { target: { value: 'line one' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })
    expect(onSend).not.toHaveBeenCalled()
  })

  it('does not send while disabled (waiting for a response)', () => {
    const { onSend, textarea } = renderInput(true)
    fireEvent.change(textarea, { target: { value: 'hi' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(onSend).not.toHaveBeenCalled()
  })
})
