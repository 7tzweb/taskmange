import { Ollama } from 'ollama';

const ollamaClient = new Ollama({ host: process.env.OLLAMA_HOST || 'http://localhost:11434' });

type ChatParams = {
  system: string;
  userPrompt: string;
  model?: string;
};

export const runChatCompletion = async ({ system, userPrompt, model }: ChatParams) => {
  const selectedModel = model || process.env.OLLAMA_MODEL || 'aya:23';
  const response = await ollamaClient.chat({
    model: selectedModel,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userPrompt },
    ],
    stream: false,
    options: {
      temperature: 0.2,
      top_p: 0.9,
      num_ctx: 4096,
    },
  });

  return response.message?.content || '';
};
