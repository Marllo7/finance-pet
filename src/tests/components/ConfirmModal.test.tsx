import { describe, it, expect, vi } from 'vitest'
import { ConfirmModal } from '../../components/ConfirmModal'
import { render, screen, fireEvent } from '@testing-library/react'

describe('ConfirmModal', () => {
  const mockOnConfirm = vi.fn()
  const mockOnCancel = vi.fn()

  it('should not render when closed', () => {
    const { container } = render(
      <ConfirmModal
        open={false}
        title="Test"
        description="Test description"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('should render when open', () => {
    render(
      <ConfirmModal
        open={true}
        title="Delete item?"
        description="This action cannot be undone."
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    )
    
    expect(screen.getByText('Delete item?')).toBeInTheDocument()
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument()
  })

  it('should call onConfirm when delete button is clicked', () => {
    render(
      <ConfirmModal
        open={true}
        title="Delete?"
        description="Are you sure?"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    )
    
    const deleteButton = screen.getByRole('button', { name: /Удалить/i })
    fireEvent.click(deleteButton)
    
    expect(mockOnConfirm).toHaveBeenCalledTimes(1)
    expect(mockOnCancel).not.toHaveBeenCalled()
  })

  it('should call onCancel when cancel button is clicked', () => {
    render(
      <ConfirmModal
        open={true}
        title="Delete?"
        description="Are you sure?"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    )
    
    // Cancel button is white with border
    const buttons = screen.getAllByRole('button')
    const cancelButton = buttons.find(btn => 
      btn.textContent === 'Отмена' && 
      btn.classList.contains('bg-white') &&
      btn.classList.contains('border')
    )
    
    expect(cancelButton).toBeDefined()
    if (cancelButton) {
      fireEvent.click(cancelButton)
      expect(mockOnCancel).toHaveBeenCalledTimes(1)
    }
  })

  it('should have red danger button', () => {
    render(
      <ConfirmModal
        open={true}
        title="Delete?"
        description="Danger!"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    )
    
    const deleteButton = screen.getByRole('button', { name: /Удалить/i })
    expect(deleteButton).toHaveClass('bg-red-600')
  })
})
