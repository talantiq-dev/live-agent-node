import { LiveSession, SessionClient } from './LiveSession';
import { AgentBridge, ClientAction, ServerContent, MediaChunk } from '@live-agent/core';

describe('LiveSession', () => {
    let mockClient: jest.Mocked<SessionClient>;
    let mockAgent: jest.Mocked<AgentBridge>;
    let session: LiveSession;
    let clientMessageHandler: (data: string) => void;

    beforeEach(() => {
        mockClient = {
            send: jest.fn(),
            onMessage: jest.fn((handler) => { clientMessageHandler = handler; }),
            onClose: jest.fn(),
        };

        mockAgent = {
            start: jest.fn(),
            sendMedia: jest.fn(),
            sendContext: jest.fn(),
            stop: jest.fn(),
            onServerContent: jest.fn(),
            onClientAction: jest.fn(),
            onError: jest.fn(),
        };

        session = new LiveSession(mockClient);
        session.setAgent(mockAgent);
    });

    it('should forward media events to the agent', () => {
        const mediaChunk: MediaChunk = { data: 'base64', mimeType: 'audio/pcm' };
        clientMessageHandler(JSON.stringify({ event: 'media', data: mediaChunk }));
        expect(mockAgent.sendMedia).toHaveBeenCalledWith(mediaChunk);
    });

    it('should handle action requests and wait for confirmation', async () => {
        const action: ClientAction = { type: 'test_tool', actionId: '123', payload: {} };

        // Trigger action from agent
        const actionPromise = (session as any).handleActionRequest(action);

        // Verify event sent to client
        expect(mockClient.send).toHaveBeenCalledWith(expect.stringContaining('test_tool'));

        // Simulate client confirmation
        clientMessageHandler(JSON.stringify({ event: 'action_confirmation', data: { actionId: '123', result: { ok: true } } }));

        await actionPromise;

        // Verify agent received the result
        expect(mockAgent.sendContext).toHaveBeenCalledWith(expect.stringContaining('{"ok":true}'));
    });

    it('should NOT send tool response for silent actions', async () => {
        const action: ClientAction = { type: 'silent_indicator', actionId: '456', payload: {}, silent: true };

        // Trigger action from agent
        const actionPromise = (session as any).handleActionRequest(action);

        // Simulate client confirmation
        clientMessageHandler(JSON.stringify({ event: 'action_confirmation', data: { actionId: '456', result: { acknowledged: true } } }));

        await actionPromise;

        // Verify agent did NOT receive a tool response or context
        expect(mockAgent.sendContext).not.toHaveBeenCalled();
    });
});
