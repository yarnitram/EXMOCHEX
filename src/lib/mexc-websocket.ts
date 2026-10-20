/**
 * EXMOCHEX — Resilient MEXC Futures WebSocket Client
 * ===================================================
 * High-frequency sub-second price streaming from MEXC edge.
 * Handles dynamic symbol subscription, keepalive pings, exponential backoff,
 * and automatic reconnect on browser tab visibility changes / network restore.
 */

import type { FuturesTicker } from "@/app/api/mexc/futures/route";

const MEXC_WS_URL = "wss://contract.mexc.com/edge";
const PING_INTERVAL_MS = 20_000;
const MAX_BACKOFF_MS = 10_000;

export type TickerListener = (ticker: FuturesTicker) => void;
export type StatusListener = (connected: boolean) => void;

class MexcWebSocketClient {
  private ws: WebSocket | null = null;
  private symbols: Set<string> = new Set();
  private tickerListeners: Set<TickerListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffMs = 1000;
  private isConnecting = false;
  private isExplicitlyClosed = false;
  private lastMessageTime = 0;

  constructor() {
    if (typeof window !== "undefined") {
      document.addEventListener("visibilitychange", this.handleVisibilityChange);
      window.addEventListener("online", this.handleOnline);
    }
  }

  public subscribe(symbols: string[]): void {
    const newSymbols: string[] = [];
    for (const sym of symbols) {
      const clean = sym.trim().toUpperCase();
      if (clean && !this.symbols.has(clean)) {
        this.symbols.add(clean);
        newSymbols.push(clean);
      }
    }

    if (newSymbols.length > 0) {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.connect();
      } else {
        for (const sym of newSymbols) {
          this.sendSub(sym);
        }
      }
    }
  }

  public unsubscribe(symbols: string[]): void {
    for (const sym of symbols) {
      const clean = sym.trim().toUpperCase();
      if (this.symbols.has(clean)) {
        this.symbols.delete(clean);
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.sendUnsub(clean);
        }
      }
    }

    if (this.symbols.size === 0 && this.ws) {
      this.disconnect();
    }
  }

  public addTickerListener(fn: TickerListener): () => void {
    this.tickerListeners.add(fn);
    return () => this.tickerListeners.delete(fn);
  }

  public addStatusListener(fn: StatusListener): () => void {
    this.statusListeners.add(fn);
    fn(this.isConnected());
    return () => this.statusListeners.delete(fn);
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  public connect(): void {
    if (typeof window === "undefined" || this.isConnecting) return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    this.isConnecting = true;
    this.isExplicitlyClosed = false;

    try {
      this.ws = new WebSocket(MEXC_WS_URL);

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.backoffMs = 1000;
        this.notifyStatus(true);
        this.startPing();

        // Subscribe to all queued symbols
        for (const sym of this.symbols) {
          this.sendSub(sym);
        }
      };

      this.ws.onmessage = (event: MessageEvent) => {
        this.lastMessageTime = Date.now();
        try {
          const raw = JSON.parse(event.data as string);
          if (raw.channel === "push.ticker" && raw.data) {
            const t = raw.data;
            const ticker: FuturesTicker = {
              symbol: t.symbol,
              lastPrice: Number(t.lastPrice) || 0,
              bid1: Number(t.bid1) || 0,
              ask1: Number(t.ask1) || 0,
              volume24: Number(t.volume24) || 0,
              amount24: Number(t.amount24) || 0,
              holdVol: Number(t.holdVol) || 0,
              lower24Price: Number(t.lower24Price) || 0,
              high24Price: Number(t.high24Price) || 0,
              riseFallRate: Number(t.riseFallRate) || 0,
              riseFallValue: Number(t.riseFallValue) || 0,
              indexPrice: Number(t.indexPrice) || 0,
              fairPrice: Number(t.fairPrice) || 0,
              fundingRate: Number(t.fundingRate) || 0,
              timestamp: Number(t.timestamp) || Date.now(),
            };

            for (const listener of this.tickerListeners) {
              listener(ticker);
            }
          }
        } catch {
          // Ignore unparseable frames (like pongs)
        }
      };

      this.ws.onerror = () => {
        this.isConnecting = false;
        // Onerror is always followed by onclose
      };

      this.ws.onclose = () => {
        this.isConnecting = false;
        this.stopPing();
        this.notifyStatus(false);
        this.ws = null;

        if (!this.isExplicitlyClosed && this.symbols.size > 0) {
          this.scheduleReconnect();
        }
      };
    } catch {
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  public disconnect(): void {
    this.isExplicitlyClosed = true;
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.notifyStatus(false);
  }

  private sendSub(symbol: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ method: "sub.ticker", param: { symbol } }));
    }
  }

  private sendUnsub(symbol: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ method: "unsub.ticker", param: { symbol } }));
    }
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ method: "ping" }));
      }
    }, PING_INTERVAL_MS);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
      this.backoffMs = Math.min(this.backoffMs * 1.5, MAX_BACKOFF_MS);
    }, this.backoffMs);
  }

  private notifyStatus(connected: boolean): void {
    for (const listener of this.statusListeners) {
      listener(connected);
    }
  }

  private handleVisibilityChange = (): void => {
    if (document.visibilityState === "visible") {
      // If we woke up from tab sleep and last tick was more than 30s ago, force a clean reconnect
      const stale = Date.now() - this.lastMessageTime > 30_000;
      if (this.symbols.size > 0 && (!this.isConnected() || stale)) {
        if (this.ws) this.ws.close();
        this.connect();
      }
    }
  };

  private handleOnline = (): void => {
    if (this.symbols.size > 0 && !this.isConnected()) {
      this.connect();
    }
  };
}

// Global browser singleton
export const mexcWs = new MexcWebSocketClient();
