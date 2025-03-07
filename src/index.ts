export interface Env {
	AI: Ai;
  }
  
  interface ChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
  }
  
  interface AIResponse {
	response: string;
  }
  
  export default {
	async fetch(request: Request, env: Env): Promise<Response> {
	  // Initialize with default value
	  let conciseResponse = false;
  
	  // Handle CORS preflight
	  if (request.method === "OPTIONS") {
		return new Response(null, {
		  headers: {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "POST, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type",
		  },
		});
	  }
  
	  // Only accept POST requests
	  if (request.method !== "POST") {
		return new Response("Method Not Allowed", { 
		  status: 405, 
		  headers: { "Access-Control-Allow-Origin": "*" } 
		});
	  }
  
	  try {
		// Get concise parameter FIRST
		const url = new URL(request.url);
		conciseResponse = url.searchParams.has("concise");
  
		// Verify content type
		const contentType = request.headers.get("content-type");
		if (!contentType?.includes("application/json")) {
		  return new Response("Invalid content type", { 
			status: 400,
			headers: { "Access-Control-Allow-Origin": "*" }
		  });
		}
  
		// Parse and validate in one step
		const requestBody = await request.json<{ messages?: unknown }>();
		
		// Validate message structure
		if (!requestBody?.messages || !Array.isArray(requestBody.messages)) {
		  return new Response("Messages array required", { 
			status: 400,
			headers: { "Access-Control-Allow-Origin": "*" }
		  });
		}
  
		// Type-safe validation
		const isValid = requestBody.messages.every((msg: unknown) => {
		  if (typeof msg !== "object" || msg === null) return false;
		  const m = msg as { role?: unknown; content?: unknown };
		  return typeof m.role === "string" && 
				 ["system", "user", "assistant"].includes(m.role) &&
				 typeof m.content === "string";
		});
  
		if (!isValid) {
		  return new Response("Invalid message format", { 
			status: 400,
			headers: { "Access-Control-Allow-Origin": "*" }
		  });
		}
  
		// Process with AI
		const response = await env.AI.run(
		  "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b", 
		  { 
			messages: requestBody.messages as ChatMessage[],
			max_tokens: 1000,
			temperature: 0.3
		  }
		) as AIResponse;
  
		// Format response
		return new Response(JSON.stringify(
		  conciseResponse 
			? { data: extractNumber(response.response) }
			: { response: response.response }
		), {
		  headers: {
			"Content-Type": "application/json",
			"Access-Control-Allow-Origin": "*"
		  }
		});
  
	  } catch (error) {
		console.error("Processing Error:", error);
		return new Response(JSON.stringify({
		  error: "Internal Server Error",
		  ...(conciseResponse && { data: null })
		}), {
		  status: 500,
		  headers: {
			"Content-Type": "application/json",
			"Access-Control-Allow-Origin": "*"
		  }
		});
	  }
	}
  } satisfies ExportedHandler<Env>;

// Helper method for numeric extraction
function extractNumber(text: string): number | null {
  const match = text.match(/-?\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : null;
}