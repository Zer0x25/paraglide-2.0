#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from './server';

async function main() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Paraglide MCP Server iniciado y escuchando en stdio.');
}

main().catch((err) => {
  console.error('Error fatal iniciando Paraglide MCP Server:', err);
  process.exit(1);
});
