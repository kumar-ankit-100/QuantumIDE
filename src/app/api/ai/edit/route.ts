import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Enhanced system prompt for code editing
const EDIT_SYSTEM_PROMPT = `You are an AI code editor assistant in a cloud IDE. When users ask to modify, change, add features, or refactor code, you must respond in a specific JSON format.

CRITICAL: You must ALWAYS respond with valid JSON in this exact format:

{
  "action": "edit" | "create" | "explain",
  "files": [
    {
      "path": "relative/path/to/file.tsx",
      "originalContent": "current file content...",
      "newContent": "updated file content...",
      "changes": [
        {
          "type": "add" | "modify" | "delete",
          "description": "Added useState hook for counter",
          "startLine": 5,
          "endLine": 5
        }
      ],
      "explanation": "I added a counter state to track button clicks"
    }
  ],
  "summary": "Added counter feature with state management"
}

RULES:
1. For "edit" action: Include COMPLETE file content in both originalContent and newContent
2. For "create" action: Only include newContent (originalContent should be empty string)
3. For "explain" action: Set files to empty array and provide detailed summary
4. changes array describes what changed (for diff highlighting)
5. Always use proper TypeScript/JavaScript syntax
6. Match the project's coding style (imports, formatting, etc.)
7. DO NOT include markdown code blocks - just raw code content
8. Ensure valid JSON - escape quotes and newlines properly

EXAMPLE EDIT REQUEST:
User: "Add a counter button to the component"

Your response:
{
  "action": "edit",
  "files": [{
    "path": "components/MyComponent.tsx",
    "originalContent": "export default function MyComponent() {\\n  return <div>Hello</div>;\\n}",
    "newContent": "import { useState } from 'react';\\n\\nexport default function MyComponent() {\\n  const [count, setCount] = useState(0);\\n\\n  return (\\n    <div>\\n      <p>Count: {count}</p>\\n      <button onClick={() => setCount(count + 1)}>\\n        Increment\\n      </button>\\n    </div>\\n  );\\n}",
    "changes": [
      {
        "type": "add",
        "description": "Added useState import",
        "startLine": 1,
        "endLine": 1
      },
      {
        "type": "add",
        "description": "Added counter state",
        "startLine": 4,
        "endLine": 4
      },
      {
        "type": "modify",
        "description": "Updated JSX to include counter UI",
        "startLine": 6,
        "endLine": 12
      }
    ],
    "explanation": "Added a counter state using useState and created a button to increment it"
  }],
  "summary": "Added counter functionality with increment button"
}

IMPORTANT: 
- Always respond with VALID JSON only
- No markdown, no extra text, just JSON
- Escape special characters properly
- Include complete file content, not snippets`;

export async function POST(req: NextRequest) {
  try {
    const { prompt, currentFile, fileContent, projectId } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Gemini API key not configured" },
        { status: 500 }
      );
    }

    // Build context
    let contextPrompt = EDIT_SYSTEM_PROMPT + "\n\n";
    contextPrompt += `Project ID: ${projectId}\n`;
    
    if (currentFile) {
      contextPrompt += `Current file: ${currentFile}\n`;
    }
    
    if (fileContent) {
      contextPrompt += `\nCurrent file content:\n${fileContent}\n\n`;
    }

    contextPrompt += `User request: ${prompt}\n\n`;
    contextPrompt += `Respond with ONLY valid JSON. No markdown, no explanations outside the JSON structure.`;

    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.3, // Lower temperature for more consistent JSON
        topP: 0.95,
        topK: 40,
      }
    });

    // Stream the response
    const result = await model.generateContentStream(contextPrompt);
    
    let fullText = '';
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            fullText += chunkText;
            
            // Send chunk to client
            const data = JSON.stringify({ content: chunkText });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
          
          // Clean up and parse the complete response
          let cleanText = fullText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          
          let editResponse;
          try {
            editResponse = JSON.parse(cleanText);
          } catch (parseError) {
            console.error('Failed to parse AI response as JSON:', cleanText);
            
            // Fallback: Try to extract JSON from the response
            const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                editResponse = JSON.parse(jsonMatch[0]);
              } catch (e) {
                throw new Error('AI returned invalid JSON format');
              }
            } else {
              throw new Error('AI response does not contain valid JSON');
            }
          }
          
          // Send final parsed result
          const finalData = JSON.stringify({ edit: editResponse, done: true });
          controller.enqueue(encoder.encode(`data: ${finalData}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          const errorData = JSON.stringify({ error: 'Streaming failed' });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
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
    console.error('AI Edit error:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to process edit request',
        details: error.toString()
      },
      { status: 500 }
    );
  }
}
