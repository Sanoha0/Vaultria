/**
 * Vaultria — EventBus
 * Lightweight pub/sub used across modules to avoid tight coupling.
 *
 * Usage:
 *   import { eventBus } from "./eventBus.js";
 *   eventBus.on("auth:changed", handler);
 *   eventBus.emit("auth:changed", payload);
 *   eventBus.off("auth:changed", handler);
 */

class EventBus {
  constructor() {
    this._listeners = {};
  }

  on(event, handler) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(handler);
  }

  once(event, handler) {
    const wrapped = (payload) => {
      handler(payload);
      this.off(event, wrapped);
    };
    this.on(event, wrapped);
  }

  off(event, handler) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter((h) => h !== handler);
  }

  emit(event, payload) {
    (this._listeners[event] || []).forEach((h) => {
      try { h(payload); } catch (err) {
        console.error(`[EventBus] Error in handler for "${event}":`, err);
      }
    });
  }

  clear(event) {
    if (event) delete this._listeners[event];
    else this._listeners = {};
  }
}

export const eventBus = new EventBus();
