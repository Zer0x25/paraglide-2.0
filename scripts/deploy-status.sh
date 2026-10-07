#!/usr/bin/env bash
set -e

TARGET_URL="${PROD_URL:-https://parapente.zer0x.org}"
VM_HOST="${DEPLOY_VM_HOST:-zxr1@192.168.122.72}"
VM_REPO_PATH="${DEPLOY_VM_PATH:-server.lab/repos/paraglide}"

echo "===================================================="
echo "🔍 ESTADO DEL DESPLIEGUE Y SERVICIOS"
echo "===================================================="
echo "🎯 URL Destino: $TARGET_URL"

# 1. Comprobar Health Check público
echo -e "\n📡 1. Consultando endpoint de salud de la API..."
HEALTH_JSON=$(curl -s --max-time 5 "$TARGET_URL/api/public/health" || echo "")

if [ -n "$HEALTH_JSON" ] && echo "$HEALTH_JSON" | grep -q '"status":"ok"'; then
  echo "✅ API en línea: $HEALTH_JSON"
else
  echo "⚠️ La API no respondió o devolvió un estado no esperado: $HEALTH_JSON"
fi

# 2. Diagnóstico SSH hacia la VM (si está accesible en red local)
echo -e "\n🖥️ 2. Verificando estado en la VM ($VM_HOST)..."
if ssh -o ConnectTimeout=3 -o BatchMode=yes "$VM_HOST" "exit" 2>/dev/null; then
  echo "✅ Conexión SSH exitosa a $VM_HOST"
  echo "📦 Commit activo en el repositorio de la VM:"
  ssh -o ConnectTimeout=3 "$VM_HOST" "cd server.lab/repos/paraglide-2.0 2>/dev/null || cd server.lab/repos/paraglide && git log -1 --oneline" 2>/dev/null || echo "   (no se pudo obtener git log)"
  echo "🐳 Estado de contenedores Docker:"
  ssh -o ConnectTimeout=3 "$VM_HOST" "cd server.lab/repos/paraglide-2.0 2>/dev/null || cd server.lab/repos/paraglide && docker compose ps --format 'table {{.Name}}\t{{.Status}}\t{{.Ports}}'" 2>/dev/null || echo "   (no se pudo obtener docker compose ps)"
else
  echo "ℹ️ VM no accesible directamente por SSH en esta red. Estado HTTP público reportado arriba."
fi

echo "===================================================="
