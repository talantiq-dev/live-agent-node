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
                    // Log raw message keys for debugging when they arrive
                    if (Math.random() < 0.05) {
                        console.log(`[GeminiAgentBridge] Raw message type: ${Object.keys(msg).join(', ')}`);
                    }
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

            if (audioData) {
                console.log(`[GeminiAgentBridge] 🎵 Received Audio Response: ${audioData.length} bytes`);
            } else if (parts.length > 0 && Math.random() < 0.1) {
                // Log partial structure occasionally if expected audio is missing
                console.log(`[GeminiAgentBridge] Parsed parts, but found no audio inlinePcm. Keys:`, parts.map((p: any) => Object.keys(p)).flat());
            }

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
        if (Math.random() < 0.05) {
            console.log(`[GeminiAgentBridge] Sending media chunk to Gemini: ${chunk.mimeType}`);
        }

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
