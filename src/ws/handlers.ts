/**
 * WebSocket message type definitions and handler helpers.
 * The actual message handling is done in GameWebSocketServer.
 * This module provides types and utilities for the WS protocol.
 */

export type ClientMessageType = 'SUBSCRIBE' | 'UNSUBSCRIBE' | 'RESYNC';

export type ServerMessageType =
  | 'SUBSCRIBED'
  | 'UNSUBSCRIBED'
  | 'FULL_STATE'
  | 'ROUND_START'
  | 'CHALLENGE'
  | 'RESPONSE'
  | 'ELIMINATION'
  | 'GAME_END'
  | 'ERROR';

export interface ClientMessage {
  type: ClientMessageType;
  gameId?: string;
}

export interface ServerMessage {
  type: ServerMessageType;
  data?: unknown;
}

/** Map engine event names to WS broadcast message types */
export const ENGINE_EVENT_TO_WS: Record<string, ServerMessageType> = {
  'game:start': 'FULL_STATE',
  'round:start': 'ROUND_START',
  'challenge:start': 'CHALLENGE',
  'agent:response': 'RESPONSE',
  'elimination': 'ELIMINATION',
  'game:end': 'GAME_END',
  'game:error': 'ERROR',
};
