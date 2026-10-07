#!/usr/bin/env bash
# Guardrail de seguridad para el agente de IA: previene acceso accidental a producción
node -e '
let input = "";
process.stdin.on("data", chunk => input += chunk);
process.stdin.on("end", () => {
  try {
    const data = JSON.parse(input);
    const cmd = (data?.toolCall?.args?.CommandLine || "").toLowerCase();
    
    // 1. Prohibido tocar puerto 5678 (Prod DB)
    if (cmd.includes("5678")) {
      console.log(JSON.stringify({
        decision: "deny",
        reason: "GUARDRAIL BLOQUEADO: El puerto 5678 corresponde a la base de datos de PRODUCCIÓN. En desarrollo debes usar el puerto 5679 (docker-compose.dev-db.yml)."
      }));
      process.exit(0);
    }

    // 2. Prohibido comandos contra la DB de producción parapente_db
    if (cmd.includes("parapente_db") && !cmd.includes("parapente_dev_db")) {
      console.log(JSON.stringify({
        decision: "deny",
        reason: "GUARDRAIL BLOQUEADO: Se detectó referencia a la DB de producción parapente_db. En desarrollo debes usar parapente_dev_db."
      }));
      process.exit(0);
    }

    // 3. Prohibido DROP DATABASE o comandos destructivos globales
    if (cmd.includes("drop database") || cmd.includes("drop schema public cascade")) {
      console.log(JSON.stringify({
        decision: "deny",
        reason: "GUARDRAIL BLOQUEADO: DROP DATABASE / DROP SCHEMA CASCADE destructivo bloqueado por seguridad."
      }));
      process.exit(0);
    }

    console.log(JSON.stringify({ decision: "allow" }));
  } catch (err) {
    // En caso de cualquier error de parseo, permitir para evitar bloquear el loop
    console.log(JSON.stringify({ decision: "allow" }));
  }
});
'
