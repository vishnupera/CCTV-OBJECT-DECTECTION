import { useEffect, useRef, useCallback } from 'react'

interface WSMessage {
  type: string
  [key: string]: any
}

interface UseAlertWebSocketOptions {
  onMessage?: (msg: WSMessage) => void
  enabled?: boolean
}

export function useAlertWebSocket({ onMessage, enabled = true }: UseAlertWebSocketOptions = {}) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const connect = useCallback(() => {
    if (!enabled) return

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const url = `${protocol}://${window.location.host}/ws/alerts`

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('[WS] Alert stream connected')
      // Start ping interval
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send('ping')
      }, 30000)
      ws.onclose = () => {
        clearInterval(pingInterval)
        // Auto-reconnect after 3s
        reconnectTimer.current = setTimeout(connect, 3000)
      }
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WSMessage
        onMessage?.(data)
      } catch { /* ignore */ }
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [enabled, onMessage])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  return wsRef
}
