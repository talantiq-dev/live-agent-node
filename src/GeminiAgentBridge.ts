import { AgentBridge, ServerContent, ClientAction, MediaChunk, Modality } from '@live-agent/core';

/**
 * Example Implementation of AgentBridge for Google's Gemini Live API.
 * Users can use this or implement their own for OpenAI Realtime, etc.
 */
export class GeminiAgentBridge implements AgentBridge {
    protected session: any = null;

    constructor(protected genAI: any) { }

    public onServerContent: (content: ServerContent) => void = () => { };
    public onClientAction: (action: ClientAction) => void = () => { };
    public onError: (error: any) => void = () => { };

    public async start(config: { systemInstruction: string; tools: any[]; modality: Modality }): Promise<void> {
        this.session = await this.genAI.live.connect({
            model: 'gemini-live-2.0-flash-native-audio',
            config: {
                systemInstruction: { parts: [{ text: config.systemInstruction }] },
                tools: config.tools,
            },
            callbacks: {
                onmessage: (msg: any) => this.handleGeminiMessage(msg),
                onerror: (err: any) => this.onError(err),
            }
        });
    }

    protected handleGeminiMessage(msg: any) {
        if (msg.serverContent) {
            const parts = msg.serverContent.modelTurn?.parts || [];
            const audio = parts.find((p: any) => p.inlinePcm)?.inlinePcm?.data;
            const text = parts.find((p: any) => p.text)?.text;

            this.onServerContent({
                audio,
                text,
                turnComplete: msg.serverContent.turnComplete,
                interrupted: msg.serverContent.interrupted,
                groundingMetadata: msg.serverContent.groundingMetadata,
            });
        }

        if (msg.toolCall?.functionCalls) {
            for (const call of msg.toolCall.functionCalls) {
                this.onClientAction({
                    type: call.name,
                    payload: call.args,
                    actionId: call.id,
                });
            }
        }
    }

    public async sendMedia(chunk: MediaChunk): Promise<void> {
        if (Math.random() < 0.05) {
            console.log(`[GeminiAgentBridge] Sending media chunk to Gemini: ${chunk.mimeType}`);
        }
        this.session?.sendRealtimeInput({
            mediaChunks: [chunk]
        });
    }

    public async sendContext(context: string): Promise<void> {
        this.session?.sendClientContent({
            turns: [{ role: 'user', parts: [{ text: context }] }],
            turnComplete: true,
        });
    }

    public async stop(): Promise<void> {
        this.session?.close();
        this.session = null;
    }
}
