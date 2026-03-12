"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveSession = void 0;
const events_1 = require("events");
class LiveSession extends events_1.EventEmitter {
    client;
    agent = null;
    pendingActions = new Map();
    constructor(client) {
        super();
        this.client = client;
        this.client.onClose(() => this.emit('disconnected'));
    }
    /**
     * Handle raw JSON string message (backwards compatibility).
     */
    handleClientMessage(data) {
        try {
            const event = JSON.parse(data);
            this.handleEvent(event);
        }
        catch (e) {
            console.error('[LiveSession] Failed to parse client event:', e);
        }
    }
    /**
     * Handle structured client event directly.
     */
    handleEvent(event) {
        this.handleClientEvent(event);
    }
    setAgent(agent) {
        this.agent = agent;
        this.agent.onServerContent = (content) => this.sendEvent({ event: 'server_content', data: content });
        this.agent.onClientAction = (action) => this.handleActionRequest(action);
        this.agent.onError = (error) => this.sendEvent({ event: 'server_content', data: { text: `Error: ${error.message}` } });
    }
    handleClientEvent(event) {
        if (!this.agent)
            return;
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
    async handleActionRequest(action) {
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
    sendEvent(event) {
        this.client.send(JSON.stringify(event));
    }
    stop() {
        this.agent?.stop();
        this.pendingActions.forEach(a => clearTimeout(a.timeout));
        this.pendingActions.clear();
    }
}
exports.LiveSession = LiveSession;
