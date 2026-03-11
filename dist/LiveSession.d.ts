import { EventEmitter } from 'events';
import { AgentBridge } from '@live-agent/core';
export interface SessionClient {
    send: (data: string) => void;
    onMessage: (handler: (data: string) => void) => void;
    onClose: (handler: () => void) => void;
}
export declare class LiveSession extends EventEmitter {
    private client;
    private agent;
    private pendingActions;
    constructor(client: SessionClient);
    handleClientMessage(data: string): void;
    setAgent(agent: AgentBridge): void;
    private handleClientEvent;
    private handleActionRequest;
    private sendEvent;
    stop(): void;
}
