import { ActionOrchestrator } from './LiveSession';

describe('ActionOrchestrator', () => {
    it('should transition to searching state when tool call arrives', async () => {
        // Mock session and event emitter
        const session = {
            on: jest.fn(),
            emit: jest.fn(),
            sendClientAction: jest.fn()
        };

        const orchestrator = new ActionOrchestrator(session as any);

        // Simulate a search tool call
        await orchestrator.handleToolCall({
            name: 'search_web_for_recipes',
            args: { query: 'pasta' },
            actionId: '123'
        });

        expect(session.sendClientAction).toHaveBeenCalledWith({
            type: 'searching_started',
            payload: { query: 'pasta' },
            actionId: '123'
        });
    });
});
