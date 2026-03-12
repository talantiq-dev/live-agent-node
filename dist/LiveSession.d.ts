import { EventEmitter } from 'events';
import { ClientEvent, AgentBridge } from '@live-agent/core';
export interface SessionClient {
    send: (data: string) => void;
    onMessage: (handler: (data: string) => void) => void;
    onClose: (handler: () => void) => void;
}
export declare class LiveSession extends EventEmitter {
    private client;
    private agent;
    private pendingActions;
    private preAgentQueue;
    private lastContextSent;
    constructor(client: SessionClient);
    /**
     * Handle raw JSON string message (backwards compatibility).
     */
    handleClientMessage(data: string): void;
    /**
     * Handle structured client event directly.
     */
    handleEvent(event: ClientEvent): void;
    setAgent(agent: AgentBridge): void;
    private handleClientEvent;
    private handleActionRequest;
    private sendEvent;
    stop(): void;
}
