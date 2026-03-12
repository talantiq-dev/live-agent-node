import { EventEmitter } from 'events';
import { ServerEvent, ClientEvent, ClientAction, AgentBridge, ServerContent } from '@live-agent/core';

export interface SessionClient {
    send: (data: string) => void;
    onMessage: (handler: (data: string) => void) => void;
    onClose: (handler: () => void) => void;
}

export class LiveSession extends EventEmitter {
    private agent: AgentBridge | null = null;
    private pendingActions = new Map<string, { resolve: (val: any) => void, timeout: NodeJS.Timeout }>();
    private preAgentQueue: ClientEvent[] = [];

    constructor(private client: SessionClient) {
        super();
        this.client.onClose(() => this.emit('disconnected'));
    }

    /**
     * Handle raw JSON string message (backwards compatibility).
     */
    public handleClientMessage(data: string) {
        try {
            const event = JSON.parse(data);
            this.handleEvent(event);
        } catch (e) {
            console.error('[LiveSession] Failed to parse client event:', e);
        }
    }

    /**
     * Handle structured client event directly.
     */
    public handleEvent(event: ClientEvent) {
        this.handleClientEvent(event);
    }

    public setAgent(agent: AgentBridge) {
        this.agent = agent;
        this.agent.onServerContent = (content) => this.sendEvent({ event: 'server_content', data: content });
        this.agent.onClientAction = (action) => this.handleActionRequest(action);
        this.agent.onError = (error) => this.sendEvent({ event: 'server_content', data: { text: `Error: ${error.message}` } });

        // Flush any events received before the agent was ready
        const queue = [...this.preAgentQueue];
        this.preAgentQueue = [];
        queue.forEach(event => this.handleClientEvent(event));
    }

    private handleClientEvent(event: ClientEvent) {
        if (!this.agent) {
            this.preAgentQueue.push(event);
            return;
        }

        switch (event.event) {
            case 'media':
                this.agent.sendMedia(event.data);
                break;
            case 'app_state':
                this.emit('app_state', event.data);
                this.agent.sendContext(`[SYSTEM STATE UPDATE]: ${JSON.stringify(event.data)}`);
                break;
            case 'action_confirmation':
                const pending = this.pendingActions.get(event.data.actionId);
                if (pending) {
                    clearTimeout(pending.timeout);
                    pending.resolve(event.data.result);
                    this.pendingActions.delete(event.data.actionId);
                }
                break;
            case 'pong':
                // Heartbeat handled
                break;
        }
    }

    private async handleActionRequest(action: ClientAction) {
        // Wrap tool call in a promise that waits for client confirmation
        const result = await new Promise((resolve) => {
            const timeout = setTimeout(() => {
                this.pendingActions.delete(action.actionId);
                resolve({ status: 'timeout' });
            }, 10000);

            this.pendingActions.set(action.actionId, { resolve, timeout });
            this.sendEvent({ event: 'client_action', data: action });
        });

        // Return result back to the agent
        if (this.agent) {
            this.agent.sendContext(`[ACTION RESULT]: ${JSON.stringify(result)}`);
        }
    }

    private sendEvent(event: ServerEvent) {
        this.client.send(JSON.stringify(event));
    }

    public stop() {
        this.agent?.stop();
        this.pendingActions.forEach(a => clearTimeout(a.timeout));
        this.pendingActions.clear();
    }
}
