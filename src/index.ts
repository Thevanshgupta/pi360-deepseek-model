export interface Env {
	AI: Ai;
  }
  
  interface ChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
  }
  
  export default {
	async fetch(request: Request, env: Env): Promise<Response> {
	  let conciseResponse = false;
  
	  if (request.method === "OPTIONS") {
		return new Response(null, {
		  headers: {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "POST, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type",
		  },
		});
	  }
  
	  if (request.method !== "POST") {
		return new Response("Method Not Allowed", {
		  status: 405,
		  headers: { "Access-Control-Allow-Origin": "*" },
		});
	  }
  
	  try {
		const url = new URL(request.url);
		conciseResponse = url.searchParams.has("concise");
  
		const contentType = request.headers.get("content-type");
		if (!contentType?.includes("application/json")) {
		  return new Response("Invalid content type", {
			status: 400,
			headers: { "Access-Control-Allow-Origin": "*" },
		  });
		}
  
		const requestBody = await request.json<{ messages?: unknown }>();
  
		if (!requestBody?.messages || !Array.isArray(requestBody.messages)) {
		  return new Response("Messages array required", {
			status: 400,
			headers: { "Access-Control-Allow-Origin": "*" },
		  });
		}
  
		const isValid = requestBody.messages.every((msg: unknown) => {
		  if (typeof msg !== "object" || msg === null) return false;
		  const m = msg as { role?: unknown; content?: unknown };
		  return (
			typeof m.role === "string" &&
			["system", "user", "assistant"].includes(m.role) &&
			typeof m.content === "string"
		  );
		});
  
		if (!isValid) {
		  return new Response("Invalid message format", {
			status: 400,
			headers: { "Access-Control-Allow-Origin": "*" },
		  });
		}
  
		// 🔥 Use LLaMA 4 model here
		const aiResponse = await env.AI.run(
			"@cf/meta/llama-4-scout-17b-16e-instruct" as any,  // 👈 bypass TS error
			{
			  messages: requestBody.messages as ChatMessage[],
			  max_tokens: 1000,
			  temperature: 0.3,
			}
		  );
		  
  
		// 💡 Defensive fallback to grab `response` string
		const responseText =
		  (aiResponse as any)?.response ?? JSON.stringify(aiResponse);
  
		return new Response(
		  JSON.stringify(
			conciseResponse
			  ? { data: extractNumber(responseText) }
			  : { response: responseText }
		  ),
		  {
			headers: {
			  "Content-Type": "application/json",
			  "Access-Control-Allow-Origin": "*",
			},
		  }
		);
	  } catch (error) {
		console.error("Processing Error:", error);
		return new Response(
		  JSON.stringify({
			error: "Internal Server Error",
			...(conciseResponse && { data: null }),
		  }),
		  {
			status: 500,
			headers: {
			  "Content-Type": "application/json",
			  "Access-Control-Allow-Origin": "*",
			},
		  }
		);
	  }
	},
  } satisfies ExportedHandler<Env>;
  
  // Extract the first number from response text
  function extractNumber(text: string): number | null {
	const match = text.match(/-?\d+(\.\d+)?/);
	return match ? parseFloat(match[0]) : null;
  }
  