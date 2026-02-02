# API Chronopost - Shipping Label Generator

API REST Node.js/Express pour la creation d'etiquettes Chronopost via SOAP, integrable avec Make (Integromat) et WooCommerce.

## Fonctionnalites

- Creation d'etiquettes Chronopost via appel SOAP
- Retour du PDF en Base64 (pret pour Make)
- Securisation par API Key
- Support de tous les produits Chronopost (5N, 2R, 2S)
- Endpoint dedie pour WooCommerce
- 100% gratuit (deployable sur Render Free Tier)

## Installation

```bash
# Cloner le projet
git clone <votre-repo>
cd chronopost-api

# Installer les dependances
npm install

# Configurer l'environnement
cp .env.example .env
# Editer .env avec vos informations

# Demarrer le serveur
npm start

# Mode developpement (hot reload)
npm run dev
```

## Configuration (.env)

```env
# Serveur
PORT=3000
NODE_ENV=development

# API Key (generer avec: openssl rand -hex 32)
API_KEY=votre_cle_api_secrete

# Chronopost (TEST ou PRODUCTION)
CHRONOPOST_ACCOUNT_NUMBER=votre_numero_compte
CHRONOPOST_PASSWORD=votre_mot_de_passe
CHRONOPOST_WSDL_URL=https://ws.chronopost.fr/shipping-cxf/ShippingServiceWS?wsdl

# Expediteur
SHIPPER_NAME=Votre Entreprise
SHIPPER_ADDRESS1=Votre Adresse
SHIPPER_ADDRESS2=
SHIPPER_CITY=Votre Ville
SHIPPER_ZIPCODE=75001
SHIPPER_COUNTRY=FR
SHIPPER_EMAIL=contact@votre-entreprise.fr
SHIPPER_PHONE=0102030405
SHIPPER_CONTACT_NAME=Service Expedition
```

## Endpoints

### Health Check
```
GET /health
```

### Creer une etiquette (format standard)
```
POST /api/create-label
Headers: X-API-Key: votre_cle_api
Content-Type: application/json

{
  "orderNumber": "WC-12345",
  "recipient": {
    "name": "Jean Dupont",
    "address1": "123 Rue de la Liberte",
    "address2": "",
    "zipCode": "69001",
    "city": "Lyon",
    "country": "FR",
    "email": "jean@example.com",
    "phone": "0612345678"
  },
  "parcel": {
    "weight": 2.5,
    "length": 30,
    "width": 20,
    "height": 15
  },
  "productCode": "5N",
  "service": "0",
  "shipDate": "2026-02-01"
}
```

### Creer une etiquette (format WooCommerce)
```
POST /api/woocommerce/create-label
Headers: X-API-Key: votre_cle_api
Content-Type: application/json

{
  "order_id": "1234",
  "total_weight": 2.5,
  "billing": {
    "first_name": "Jean",
    "last_name": "Dupont",
    "email": "jean@example.com",
    "phone": "0612345678",
    "address_1": "123 Rue Test",
    "address_2": "",
    "postcode": "69001",
    "city": "Lyon",
    "country": "FR"
  },
  "shipping": {
    "first_name": "Jean",
    "last_name": "Dupont",
    "address_1": "123 Rue Test",
    "address_2": "",
    "postcode": "69001",
    "city": "Lyon",
    "country": "FR"
  },
  "chronopost_product": "5N",
  "chronopost_service": "0"
}
```

### Reponse
```json
{
  "success": true,
  "data": {
    "skybillNumber": "XY504821570VF",
    "reservationNumber": "88895048215708670",
    "pdfLabel": "JVBERi0xLjQK... (base64)",
    "trackingUrl": "https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT=XY504821570VF"
  },
  "orderNumber": "WC-12345",
  "createdAt": "2026-01-31T15:30:00.000Z"
}
```

## Produits Chronopost

| Produit | productCode | service | Description |
|---------|-------------|---------|-------------|
| Chrono Ambient 13H (semaine) | `5N` | `0` | Livraison en semaine |
| Chrono Ambient 13H (samedi) | `5N` | `6` | Livraison le samedi |
| Chrono Fresh 13H | `2R` | `0` | Produits frais |
| Chrono Freeze 13H | `2S` | `0` | Produits surgeles |

## Integration Make

1. **Trigger**: WooCommerce - Watch Orders
2. **HTTP Module**: POST vers `/api/woocommerce/create-label`
3. **Base64**: Decoder `{{data.pdfLabel}}` avec `toBinary(data.pdfLabel; "base64")`
4. **Email**: Envoyer le PDF en piece jointe

## Deploiement sur Render (Gratuit)

1. Creer un compte sur [Render.com](https://render.com)
2. Connecter votre repository GitHub
3. Creer un "Web Service" avec:
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance Type: Free
4. Ajouter les variables d'environnement
5. Deployer

**Note**: Le Free Tier a un cold start de 30-60s apres 15min d'inactivite.

## Tests

```bash
# Lancer les tests
npm test

# Avec couverture
npm run test:coverage
```

## Securite

- API Key obligatoire (header `X-API-Key`)
- Ne jamais commit le fichier `.env`
- Generer une cle API forte: `openssl rand -hex 32`

## Licence

MIT
