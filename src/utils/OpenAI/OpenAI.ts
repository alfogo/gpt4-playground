import { OpenAIChatMessage, OpenAIConfig } from "./OpenAI.types";
import { SSEParser } from "./sse-parser";

export const defaultConfig = {
  model: "gpt-3.5-turbo",
  temperature: 0.5,
  max_tokens: 2048,
  top_p: 1,
  frequency_penalty: 0,
  presence_penalty: 0.6,
};

export type OpenAIRequest = {
  messages: OpenAIChatMessage[];
} & OpenAIConfig;

export const getOpenAICompletion = async (
  payload: OpenAIRequest
) => {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const apiEndpoint = process.env.apiEndpoint;
  const apiKey = process.env.apiKey;

  const response = await fetch(apiEndpoint as string, {
    headers: {
      "api-key": apiKey as string,
      "Content-Type": "application/json",
    },
    method: "POST",
    body: JSON.stringify(payload),
  });
  
  // Check for errors
  if (!response.ok) {
    throw new Error(await response.text());
  }

  const source: UnderlyingDefaultSource<Uint8Array> = {
    start: async (controller) => {
      if (response && response.body && response.ok) {
        const reader = response.body.getReader();
        try {
          const SSEEvents = {
            onError: (error: any) => {
              controller.error(error);
            },
            onData: (data: string) => {
              const queue = new TextEncoder().encode(data);
              controller.enqueue(queue);
            },
            onComplete: () => {
              controller.close();
            },
          };
      
          const decoder = new TextDecoder();
          const sseParser = new SSEParser(SSEEvents);
      
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
      
            const chunkValue = decoder.decode(value);
            sseParser.parseSSE(chunkValue);
          }
        } catch (e) {
          controller.error(e);
        } finally {
          controller.close();
          reader.releaseLock();
        }
      } else {
        if (!response.ok) {
          controller.error(response.statusText);
        } else {
          controller.error("No response body");
        }
      }
    },
  };

  return new ReadableStream(source);
};

