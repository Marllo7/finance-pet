import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AddGoalModal } from '../../components/AddGoalModal'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AuthProvider } from '../../contexts/AuthContext'
import { SettingsProvider } from '../../contexts/SettingsContext'
import type { Goal } from '../../types/transaction'

const mockOnSave = vi.fn().mockResolvedValue({ error: null })
const mockOnClose = vi.fn()

function renderModal(initial?: Goal | null) {
  return render(
    <AuthProvider>
      <SettingsProvider>
        <AddGoalModal
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          initial={initial}
        />
      </SettingsProvider>
    </AuthProvider>
  )
}

describe('AddGoalModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render modal when open', () => {
    renderModal()
    expect(screen.getByText(/Новая цель/i)).toBeInTheDocument()
  })

  it('should validate name is required', async () => {
    renderModal()
    const saveButton = screen.getByRole('button', { name: /Добавить/i })
    fireEvent.click(saveButton)
    
    await waitFor(() => {
      expect(screen.getByText(/Введите название цели/i)).toBeInTheDocument()
    })
    expect(mockOnSave).not.toHaveBeenCalled()
  })

  it('should validate target amount is required', async () => {
    renderModal()
    const nameInput = screen.getByPlaceholderText(/Название цели/i)
    const saveButton = screen.getByRole('button', { name: /Добавить/i })
    
    fireEvent.change(nameInput, { target: { value: 'Test Goal' } })
    fireEvent.click(saveButton)
    
    await waitFor(() => {
      expect(screen.getByText(/Введите корректную сумму цели/i)).toBeInTheDocument()
    })
  })

  it('should save goal with valid data', async () => {
    renderModal()
    const nameInput = screen.getByPlaceholderText(/Название цели/i)
    const targetInputs = screen.getAllByPlaceholderText(/0/i)
    const targetInput = targetInputs[0]
    const saveButton = screen.getByRole('button', { name: /Добавить/i })
    
    fireEvent.change(nameInput, { target: { value: 'Test Goal' } })
    fireEvent.change(targetInput, { target: { value: '1000' } })
    fireEvent.click(saveButton)
    
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith({
        name: 'Test Goal',
        icon: '🎯',
        targetAmount: 1000,
        savedAmount: 0,
        deadline: undefined,
        color: '#7c5cff',
      })
    })
  })

  it('should clear deadline when clear button is clicked', () => {
    renderModal()
    // Find date input by its type
    const dateInputs = screen.getAllByDisplayValue('')
    const dateInput = dateInputs[dateInputs.length - 1] as HTMLInputElement
    
    fireEvent.change(dateInput, { target: { value: '2026-12-31' } } as any)
    
    // Find and click clear button
    const clearButtons = screen.getAllByTitle(/Очистить дату/i)
    if (clearButtons.length > 0) {
      fireEvent.click(clearButtons[0])
      // Deadline should be cleared
      expect(dateInput).toHaveValue('')
    }
  })

  it('should edit initial goal data', () => {
    const initialGoal: Goal = {
      id: '1',
      name: 'Existing Goal',
      icon: '🎯',
      targetAmount: 5000,
      savedAmount: 1000,
      deadline: '2026-06-30',
      color: '#7c5cff',
      createdAt: '2026-01-01',
    }
    
    renderModal(initialGoal)
    
    expect(screen.getByDisplayValue('Existing Goal')).toBeInTheDocument()
    expect(screen.getByDisplayValue('5000')).toBeInTheDocument()
  })
})
