#!/bin/bash

# Script de pruebas del Control Tower
# =====================================

BASE_URL="https://control-tower-manus.vercel.app"
BYPASS_TOKEN="G2b8sBLJ5w9snmA4b80RInV2Jv8f9ChU"
ORCHESTRATOR_TOKEN="999048e3214bf276b6d220c39cc452927025f40aa06a0d2e4cace7f302601298"

echo "🚀 INICIANDO PRUEBAS DEL CONTROL TOWER"
echo "======================================"
echo ""

# Test 1: Crear un nuevo ciclo
echo "📝 TEST 1: Crear nuevo ciclo"
echo "----------------------------"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/cycle/start.js" \
  -H "x-vercel-protection-bypass: $BYPASS_TOKEN" \
  -H "Authorization: Bearer $ORCHESTRATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode": "NORMAL", "topic": "Análisis de tendencias en IA 2025"}')

echo "$RESPONSE" | jq '.'
CYCLE_ID=$(echo "$RESPONSE" | jq -r '.cycle_id')
echo ""
echo "✅ Ciclo creado: $CYCLE_ID"
echo ""

# Esperar un momento para que se procese
sleep 2

# Test 2: Obtener información del ciclo
echo "📊 TEST 2: Obtener información del ciclo"
echo "----------------------------------------"
curl -s -X GET "$BASE_URL/api/cycle/$CYCLE_ID.js" \
  -H "x-vercel-protection-bypass: $BYPASS_TOKEN" \
  -H "Authorization: Bearer $ORCHESTRATOR_TOKEN" | jq '.'
echo ""

# Test 3: Verificar endpoint raíz
echo "🏠 TEST 3: Verificar endpoint raíz"
echo "-----------------------------------"
curl -s -X GET "$BASE_URL/api/index.js" \
  -H "x-vercel-protection-bypass: $BYPASS_TOKEN" | jq '.'
echo ""

echo "✅ PRUEBAS COMPLETADAS"
echo "====================="
