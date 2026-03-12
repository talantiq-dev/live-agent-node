"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiAgentBridge = void 0;
/**
 * Example Implementation of AgentBridge for Google's Gemini Live API.
 * Users can use this or implement their own for OpenAI Realtime, etc.
 */
class GeminiAgentBridge {
    genAI;
    session = null;
    constructor(genAI) {
        this.genAI = genAI;
    }
    onServerContent = () => { };
    onClientAction = () => { };
    onError = () => { };
    async start(config) {
        this.session = await this.genAI.live.connect({
            model: 'gemini-live-2.0-flash-native-audio',
            config: {
                systemInstruction: { parts: [{ text: config.systemInstruction }] },
                tools: config.tools,
            },
            callbacks: {
                onmessage: (msg) => this.handleGeminiMessage(msg),
                onerror: (err) => this.onError(err),
            }
        });
    }
    handleGeminiMessage(msg) {
        if (msg.serverContent) {
            const parts = msg.serverContent.modelTurn?.parts || [];
            const audio = parts.find((p) => p.inlinePcm)?.inlinePcm?.data;
            const text = parts.find((p) => p.text)?.text;
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
    async sendMedia(chunk) {
        if (Math.random() < 0.05) {
            console.log(`[GeminiAgentBridge] Sending media chunk to Gemini: ${chunk.mimeType}`);
        }
        this.session?.sendRealtimeInput({
            mediaChunks: [chunk]
        });
    }
    async sendContext(context) {
        this.session?.sendClientContent({
            turns: [{ role: 'user', parts: [{ text: context }] }],
            turnComplete: true,
        });
    }
    async stop() {
        this.session?.close();
        this.session = null;
    }
}
exports.GeminiAgentBridge = GeminiAgentBridge;
