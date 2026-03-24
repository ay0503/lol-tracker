/**
 * LLM integration using any OpenAI-compatible API.
 * Set OPENAI_API_URL and OPENAI_API_KEY to use (e.g., OpenAI, Ollama, LM Studio, etc.)
 * If not configured, LLM calls will throw — callers should handle gracefully with fallbacks.
 */
import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type Message = {
  role: Role;
  content: string;
  name?: string;
  tool_call_id?: string;
};

export type ResponseFormat = {
  type: "text" | "json_object" | "json_schema";
  json_schema?: {
    name: string;
    strict?: boolean;
    schema: Record<string, unknown>;
  };
};

export type InvokeParams = {
  messages: Message[];
  model?: string;
  response_format?: ResponseFormat;
  max_tokens?: number;
};

export type InvokeResult = {
  choices: Array<{
    message: {
      role: string;
      content: string | null;
    };
  }>;
};

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const apiUrl = ENV.openaiApiUrl;
  const apiKey = ENV.openaiApiKey;

  if (!apiUrl || !apiKey) {
    throw new Error(
      "LLM not configured. Set OPENAI_API_URL and OPENAI_API_KEY environment variables."
    );
  }

  const url = apiUrl.endsWith("/v1/chat/completions")
    ? apiUrl
    : `${apiUrl.replace(/\/$/, "")}/v1/chat/completions`;

  const payload: Record<string, unknown> = {
    model: params.model || "gpt-4o-mini",
    messages: params.messages,
    max_tokens: params.max_tokens || 1024,
  };

  if (params.response_format) {
    payload.response_format = params.response_format;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  return (await response.json()) as InvokeResult;
}
