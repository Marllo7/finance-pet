/** Мост "тур → чат": раскрыть чат и/или отправить демо-текст. */
import { useEffect, useRef } from 'react'

export const OPEN_CHAT_EVENT = 'fp-chat-open'
export const TOUR_DEMO_EVENT = 'fp-tour-chat-demo'

export function openChat() {
  window.dispatchEvent(new Event(OPEN_CHAT_EVENT))
}

export function sendTourDemo(text: string) {
  window.dispatchEvent(new CustomEvent<string>(TOUR_DEMO_EVENT, { detail: text }))
}

/** Хук-мост для ChatWidget: раскрыть чат и отправить демо-текст тура. */
export function useTourDemo(onSend: (text: string) => void) {
  const ref = useRef(onSend)
  ref.current = onSend
  useEffect(() => {
    function handler(e: Event) {
      const text = (e as CustomEvent<string>).detail
      if (typeof text === 'string' && text.trim()) ref.current(text)
    }
    window.addEventListener(TOUR_DEMO_EVENT, handler)
    return () => window.removeEventListener(TOUR_DEMO_EVENT, handler)
  }, [])
}
