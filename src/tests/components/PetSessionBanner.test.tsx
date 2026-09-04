import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PetSessionBanner } from '../../components/PetSessionBanner'
import { render, screen } from '@testing-library/react'
import { AuthProvider } from '../../contexts/AuthContext'
import { SettingsProvider } from '../../contexts/SettingsContext'

const USER_ID = 'user-abc'

function renderBanner(props: { userId?: string | null } = {}) {
  return render(
    <AuthProvider>
      <SettingsProvider>
        <PetSessionBanner userId={props.userId ?? null} />
      </SettingsProvider>
    </AuthProvider>
  )
}

describe('PetSessionBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  it('should not render when no session exists', () => {
    const { container } = renderBanner()
    expect(container).toBeEmptyDOMElement()
  })

  it('should render when session exists in localStorage (guest scope)', () => {
    const sessionData = {
      startTime: Date.now() - 60000, // 1 minute ago
      messageCount: 5,
      lastInteraction: Date.now() - 30000,
    }
    localStorage.setItem('pet_session_data_guest', JSON.stringify(sessionData))

    renderBanner()

    expect(screen.getByText(/Сессия питомца/i)).toBeInTheDocument()
  })

  it('should isolate session by user id', () => {
    const sessionData = {
      startTime: Date.now() - 60000,
      messageCount: 5,
      lastInteraction: Date.now() - 30000,
    }
    localStorage.setItem(`pet_session_data_${USER_ID}`, JSON.stringify(sessionData))

    renderBanner({ userId: USER_ID })

    expect(screen.getByText(/Сессия питомца/i)).toBeInTheDocument()
  })

  it('should expire session after duration', () => {
    const sessionData = {
      startTime: Date.now(),
      messageCount: 5,
      lastInteraction: Date.now(),
    }
    localStorage.setItem('pet_session_data_guest', JSON.stringify(sessionData))

    renderBanner()

    // Fast forward past session duration (5 minutes)
    vi.advanceTimersByTime(5 * 60 * 1000 + 1000)

    // Session should be expired and removed from localStorage
    const saved = localStorage.getItem('pet_session_data_guest')
    expect(saved).toBeNull()
  })
})
