import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export interface ToolDefinition<T extends Record<string, z.ZodTypeAny> = Record<string, z.ZodTypeAny>> {
  name: string;
  description: string;
  inputSchema?: T;
  handler: (args: any) => Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }>;
}

export function registerTool(server: McpServer, tool: ToolDefinition) {
  if (tool.inputSchema) {
    (server as any).registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
      },
      tool.handler
    );
  } else {
    (server as any).registerTool(
      tool.name,
      {
        description: tool.description,
      },
      tool.handler
    );
  }
}
