import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// System prompt for the AI coding assistant
const SYSTEM_PROMPT = `You are an AI coding copilot inside a cloud-based containerized IDE.
You must behave like a senior software engineer guiding a junior developer.
Your responses must always be grounded in the user's live file, project structure,
and framework conventions.

CONTEXT RULES:
1. Consider current file + cursor position as primary code context.
2. Suggest code that can be directly inserted without breaking syntax.
3. Always match project technology (React, Next.js, Node, Vite etc).
4. When user asks "why/how", give short reasoning before code.
5. Return minimal patch instead of entire file unless explicitly asked.

CODE CHANGE REQUESTS:
When user asks to "change", "modify", "update", or "refactor" code:
1. Show the COMPLETE updated code, not just the changes
2. Use proper markdown code blocks with language tags (e.g., \`\`\`typescript)
3. Include comments explaining what changed if it's not obvious
4. If the change affects multiple parts, show all relevant sections

CHAT MODE:
- Provide full reasoning and explanation.
- Generate new components/modules when asked.
- May return multiple code blocks with proper markdown.
- Use \`\`\`language for code blocks (e.g., \`\`\`typescript, \`\`\`javascript, \`\`\`python).
- For code snippets, ALWAYS use markdown code blocks with language tags.

REFACTORING MODE:
- When asked to refactor or change code, return the COMPLETE updated code.
- Explain why the refactor improves the code.
- Use code blocks with proper syntax highlighting.

FORMAT RULES:
- Always wrap code in markdown code blocks: \`\`\`language
- Use proper language tags: typescript, javascript, jsx, tsx, python, css, html, json, etc.
- For inline code, use single backticks: \`code\`
- For multi-line code, use triple backticks with language

If user asks for component, test, API route, or config, generate it.
Do not hallucinate libraries; detect installed dependencies from package.json.

Be concise but helpful. Prioritize actionable code over theory.`;

export async function POST(req: NextRequest) {
  try {
    const { projectId, currentFile, fileContent, messages } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Gemini API key not configured" },
        { status: 500 }
      );
    }

    // Build context for AI
    let contextPrompt = SYSTEM_PROMPT + "\n\n";
    
    if (currentFile) {
      contextPrompt += `Current file: ${currentFile}\n`;
    }
    
    if (fileContent) {
      contextPrompt += `\nFile content:\n\`\`\`\n${fileContent}\n\`\`\`\n\n`;
    }

    // Get the model - using gemini-2.5-flash which is available and stable
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash"
    });

    // Build conversation history
    const chatHistory = messages.slice(0, -1).map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));

    // Start chat with history
    const chat = model.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: contextPrompt }],
        },
        {
          role: 'model',
          parts: [{ text: 'Understood. I\'m ready to assist with your code. What would you like help with?' }],
        },
        ...chatHistory,
      ],
    });

    // Get the last user message
    const lastMessage = messages[messages.length - 1];
    
    // Stream the response
    const result = await chat.sendMessageStream(lastMessage.content);

    // Create a readable stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text();
            const data = JSON.stringify({ content: text });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('AI Chat error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process AI request' },
      { status: 500 }
    );
  }
}
