import { describe, it, expect } from 'vitest'
import { AuthPage } from '../../pages/AuthPage'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider } from '../../contexts/AuthContext'
import { SettingsProvider } from '../../contexts/SettingsContext'

function renderAuthPage() {
  return render(
    <AuthProvider>
      <SettingsProvider>
        <AuthPage />
      </SettingsProvider>
    </AuthProvider>
  )
}

describe('AuthPage — показ/скрытие пароля', () => {
  it('renders password input hidden by default', () => {
    renderAuthPage()
    const passwordInput = screen.getByPlaceholderText('••••••••')
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  it('shows password when toggle is clicked', async () => {
    const user = userEvent.setup()
    renderAuthPage()

    const passwordInput = screen.getByPlaceholderText('••••••••')
    await user.type(passwordInput, 'secret123')

    // Кнопка показа пароля — единственная кнопка с Eye-иконкой рядом с полем
    const toggleButton = screen.getByRole('button', { name: '' })
    await user.click(toggleButton)
    expect(passwordInput).toHaveAttribute('type', 'text')

    // Повторное нажатие скрывает пароль
    await user.click(toggleButton)
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  it('keeps typed password value after toggling visibility', async () => {
    const user = userEvent.setup()
    renderAuthPage()

    const passwordInput = screen.getByPlaceholderText('••••••••') as HTMLInputElement
    await user.type(passwordInput, 'secret123')

    const toggleButton = screen.getByRole('button', { name: '' })
    await user.click(toggleButton)
    expect(passwordInput.value).toBe('secret123')
  })
})
