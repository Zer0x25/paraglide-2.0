import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ParaglideApiClient, apiClient } from './client/api-client';
import { mcpConfig } from './config';
import { registerDisponibilidadTools } from './tools/disponibilidad';
import { registerTarifasTools } from './tools/tarifas';
import { registerReservasTools } from './tools/reservas';
import { registerAgendamientoTools } from './tools/agendamiento';
import { registerWorkflowTools } from './tools/workflow';
import { registerConsultasTools } from './tools/consultas';

export function createMcpServer(client: ParaglideApiClient = apiClient): McpServer {
  const server = new McpServer({
    name: mcpConfig.serverName,
    version: mcpConfig.serverVersion,
  });

  // Registrar módulos de tools
  registerDisponibilidadTools(server, client);
  registerTarifasTools(server, client);
  registerReservasTools(server, client);
  registerAgendamientoTools(server, client);
  registerWorkflowTools(server, client);
  registerConsultasTools(server, client);

  return server;
}
