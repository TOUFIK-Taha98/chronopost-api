#!/bin/bash

# Script de test pour l'API Chronopost
# Assurez-vous que le serveur est démarré : npm start

echo "======================================"
echo "🧪 Tests API Chronopost"
echo "======================================"
echo ""

# Couleurs pour les logs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# URL de base (changez selon votre environnement)
BASE_URL="http://localhost:3000"
API_KEY="test-api-key-changez-moi-en-production"

echo -e "${BLUE}1. Test Health Check${NC}"
echo "GET $BASE_URL/health"
echo ""
curl -s "$BASE_URL/health" | jq
echo ""
echo ""

echo -e "${BLUE}2. Test Création d'étiquette${NC}"
echo "POST $BASE_URL/api/create-label"
echo ""
curl -s -X POST "$BASE_URL/api/create-label" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d @test-request.json | jq
echo ""
echo ""

echo -e "${BLUE}3. Test Endpoint WooCommerce/Make${NC}"
echo "POST $BASE_URL/api/woocommerce/create-label"
echo ""
curl -s -X POST "$BASE_URL/api/woocommerce/create-label" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d @test-woocommerce.json | jq
echo ""
echo ""

echo -e "${GREEN}✅ Tests terminés !${NC}"
echo ""
echo "💡 Pour décoder le PDF en Base64 :"
echo "   - Copier la valeur de 'pdfLabel'"
echo "   - Utiliser un décodeur Base64 en ligne ou :"
echo "   echo 'BASE64_STRING' | base64 -d > etiquette.pdf"
echo ""
