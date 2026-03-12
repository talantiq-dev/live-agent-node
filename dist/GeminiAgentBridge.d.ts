import { AgentBridge, ServerContent, ClientAction, MediaChunk, Modality } from '@live-agent/core';
/**
 * Example Implementation of AgentBridge for Google's Gemini Live API.
 * Users can use this or implement their own for OpenAI Realtime, etc.
 */
export declare class GeminiAgentBridge implements AgentBridge {
    protected genAI: any;
    protected session: any;
    constructor(genAI: any);
    onServerContent: (content: ServerContent) => void;
    onClientAction: (action: ClientAction) => void;
    onError: (error: any) => void;
    start(config: {
        systemInstruction: string;
        tools: any[];
        modality: Modality;
        model?: string;
    }): Promise<void>;
    protected handleGeminiMessage(msg: any): void;
    sendMedia(chunk: MediaChunk): Promise<void>;
    sendContext(context: string): Promise<void>;
    stop(): Promise<void>;
}
