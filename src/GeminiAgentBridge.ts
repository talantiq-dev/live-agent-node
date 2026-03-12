import { AgentBridge, ServerContent, ClientAction, MediaChunk, Modality } from '@live-agent/core';

/**
 * Example Implementation of AgentBridge for Google's Gemini Live API.
 * Users can use this or implement their own for OpenAI Realtime, etc.
 */
export class GeminiAgentBridge implements AgentBridge {
    protected session: any = null;

    constructor(protected genAI: any) { }

    public onServerContent: (content: ServerContent) => void = () => { };
    public onClientAction: (action: ClientAction) => Promise<any> = async () => { };
    public onError: (error: any) => void = () => { };

    public async start(config: { systemInstruction: string; tools: any[]; modality: Modality; model?: string }): Promise<void> {
        const targetModel = config.model || 'gemini-2.0-flash-exp';
        console.log(`[GeminiAgentBridge] Connecting to Live API with model: ${targetModel}`);
        this.session = await this.genAI.live.connect({
            model: targetModel,
            config: {
                systemInstruction: { parts: [{ text: config.systemInstruction }] },
                tools: config.tools,
                responseModalities: ["AUDIO"],
            },
            callbacks: {
                onmessage: (msg: any) => {
                    this.handleGeminiMessage(msg)
                },
                onerror: (err: any) => {
                    console.error('[GeminiAgentBridge] Gemini WebSocker ERROR:', err);
                    this.onError(err);
                },
                onclose: (event: any) => {
                    console.log('[GeminiAgentBridge] Gemini session CLOSED:', event);
                }
            }
        });
    }

    protected handleGeminiMessage(msg: any) {
        if (msg.serverContent) {
            const serverContent = msg.serverContent || msg.server_content;
            const modelTurn = serverContent?.modelTurn || serverContent?.model_turn;
            const parts = modelTurn?.parts || [];

            // Search for audio payload across all possible Vertex and GenAI keys
            let audioData: string | undefined;
            for (const p of parts) {
                const audioObj = p.inlinePcm || p.inline_pcm || p.inlineData || p.inline_data;
                if (audioObj?.data) {
                    audioData = audioObj.data;
                    break;
                }
            }

            const text = parts.find((p: any) => p.text)?.text;

            this.onServerContent({
                audio: audioData,
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

        if (chunk.mimeType?.startsWith('image/')) {
            this.session?.sendRealtimeInput({
                mediaChunks: [{
                    mimeType: chunk.mimeType,
                    data: chunk.data
                }]
            } as any);
        } else {
            this.session?.sendRealtimeInput({
                audio: {
                    mimeType: chunk.mimeType || 'audio/pcm;rate=16000',
                    data: chunk.data
                }
            });
        }
    }

    public async sendContext(context: string, turnComplete: boolean = true): Promise<void> {
        this.session?.sendClientContent({
            turns: [{ role: 'user', parts: [{ text: context }] }],
            turnComplete,
        });
    }

    public async sendToolResponse(actionId: string, name: string, result: any): Promise<void> {
        console.log(`[GeminiAgentBridge] Sending tool response for ${name}`);
        this.session?.sendToolResponse({
            functionResponses: [{
                name: name,
                response: { result },
                id: actionId
            }]
        });
    }

    public async stop(): Promise<void> {
        this.session?.close();
        this.session = null;
    }
}
