require('dotenv').config();
const express = require('express');
const soap = require('soap');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== MIDDLEWARES ====================
app.use(helmet()); // Sécurité headers HTTP
app.use(cors()); // Permettre les requêtes cross-origin
app.use(express.json()); // Parser JSON

// Middleware d'authentification API Key
const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({
      success: false,
      error: 'API Key invalide ou manquante'
    });
  }

  next();
};

// ==================== FONCTIONS UTILITAIRES ====================

// Fonction pour transformer les données WooCommerce vers le format interne
function transformWooCommerceData(wooData) {
  // Utiliser les données de livraison si disponibles, sinon facturation
  const shipping = wooData.shipping || wooData.billing || {};
  const billing = wooData.billing || {};

  // Construire le nom complet
  const firstName = shipping.first_name || billing.first_name || '';
  const lastName = shipping.last_name || billing.last_name || '';
  const fullName = `${firstName} ${lastName}`.trim();

  // Calculer le poids total des produits (ou utiliser le poids fourni)
  let totalWeight = wooData.total_weight || 0.5; // Poids par défaut 0.5 kg

  if (wooData.line_items && Array.isArray(wooData.line_items)) {
    const calculatedWeight = wooData.line_items.reduce((sum, item) => {
      const itemWeight = parseFloat(item.weight) || 0;
      const quantity = parseInt(item.quantity) || 1;
      return sum + (itemWeight * quantity);
    }, 0);
    if (calculatedWeight > 0) {
      totalWeight = calculatedWeight;
    }
  }

  // Date d'envoi : aujourd'hui + 1 jour par défaut, ou date fournie
  const shipDate = wooData.ship_date || (() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  })();

  return {
    orderNumber: wooData.order_id?.toString() || wooData.id?.toString() || wooData.number?.toString(),
    recipient: {
      name: fullName || shipping.company || 'Client',
      address1: shipping.address_1 || billing.address_1 || '',
      address2: shipping.address_2 || billing.address_2 || '',
      zipCode: shipping.postcode || billing.postcode || '',
      city: shipping.city || billing.city || '',
      country: shipping.country || billing.country || 'FR',
      email: billing.email || wooData.billing_email || '',
      phone: shipping.phone || billing.phone || wooData.billing_phone || ''
    },
    parcel: {
      weight: totalWeight,
      length: wooData.parcel_length || 30,
      width: wooData.parcel_width || 20,
      height: wooData.parcel_height || 15
    },
    productCode: wooData.chronopost_product || '5N',
    service: wooData.chronopost_service || '0',
    shipDate: shipDate,
    expirationDate: wooData.expiration_date || null
  };
}

// Fonction pour construire la requête SOAP XML
function buildSoapRequest(data) {
  const {
    orderNumber,
    recipient,
    parcel,
    productCode = '5N',
    service = '0',
    shipDate,
    expirationDate
  } = data;

  // Calculer la date d'expiration pour les produits frais (2R, 2S)
  // Si non fournie, utiliser shipDate + 5 jours
  // Format requis: YYYY-MM-DDThh:mm:ss (xs:dateTime)
  let calculatedExpirationDate = expirationDate;
  if (!calculatedExpirationDate && (productCode === '2R' || productCode === '2S')) {
    const expDate = new Date(shipDate);
    expDate.setDate(expDate.getDate() + 5);
    expDate.setHours(23, 59, 59);
    calculatedExpirationDate = expDate.toISOString().slice(0, 19); // YYYY-MM-DDThh:mm:ss
  }

  return {
    headerValue: {
      accountNumber: process.env.CHRONOPOST_ACCOUNT_NUMBER,
      idEmit: 'CHRFR',
      identWebPro: '',
      subAccount: ''
    },
    shipperValue: {
      shipperAdress1: process.env.SHIPPER_ADDRESS1,
      shipperAdress2: process.env.SHIPPER_ADDRESS2 || '',
      shipperCity: process.env.SHIPPER_CITY,
      shipperCivility: 'M',
      shipperContactName: process.env.SHIPPER_CONTACT_NAME,
      shipperCountry: process.env.SHIPPER_COUNTRY,
      shipperCountryName: process.env.SHIPPER_COUNTRY === 'FR' ? 'FRANCE' : process.env.SHIPPER_COUNTRY,
      shipperEmail: process.env.SHIPPER_EMAIL,
      shipperMobilePhone: '',
      shipperName: process.env.SHIPPER_NAME,
      shipperName2: '',
      shipperPhone: process.env.SHIPPER_PHONE,
      shipperPreAlert: '0',
      shipperZipCode: process.env.SHIPPER_ZIPCODE,
      shipperType: '1'
    },
    customerValue: {
      customerAdress1: process.env.SHIPPER_ADDRESS1,
      customerAdress2: process.env.SHIPPER_ADDRESS2 || '',
      customerCity: process.env.SHIPPER_CITY,
      customerCivility: 'M',
      customerContactName: process.env.SHIPPER_CONTACT_NAME,
      customerCountry: process.env.SHIPPER_COUNTRY,
      customerCountryName: process.env.SHIPPER_COUNTRY === 'FR' ? 'FRANCE' : process.env.SHIPPER_COUNTRY,
      customerEmail: process.env.SHIPPER_EMAIL,
      customerMobilePhone: '',
      customerName: process.env.SHIPPER_NAME,
      customerName2: '',
      customerPhone: process.env.SHIPPER_PHONE,
      customerPreAlert: '0',
      customerZipCode: process.env.SHIPPER_ZIPCODE,
      printAsSender: 'N'
    },
    recipientValue: {
      recipientName: recipient.name,
      recipientName2: '',
      recipientAdress1: recipient.address1,
      recipientAdress2: recipient.address2 || '',
      recipientZipCode: recipient.zipCode,
      recipientCity: recipient.city,
      recipientCountry: recipient.country,
      recipientContactName: recipient.name,
      recipientEmail: recipient.email,
      recipientPhone: recipient.phone,
      recipientMobilePhone: '',
      recipientPreAlert: '0',
      recipientType: '2'
    },
    refValue: {
      customerSkybillNumber: '',
      recipientRef: orderNumber,
      shipperRef: orderNumber,
      idRelais: ''
    },
    skybillValue: {
      bulkNumber: '1',
      codCurrency: 'EUR',
      codValue: '0',
      content1: '',
      content2: '',
      content3: '',
      content4: '',
      content5: '',
      customsCurrency: 'EUR',
      customsValue: '',
      evtCode: 'DC',
      insuredCurrency: 'EUR',
      insuredValue: '0',
      latitude: '',
      longitude: '',
      masterSkybillNumber: '',
      objectType: 'MAR',
      portCurrency: '',
      portValue: '0',
      productCode: productCode,
      qualite: '',
      service: service,
      shipDate: shipDate,
      shipHour: new Date().getHours().toString(),
      skybillRank: '1',
      source: '',
      weight: parcel.weight.toString(),
      weightUnit: 'KGM',
      height: parcel.height ? parcel.height.toString() : '10',
      length: parcel.length ? parcel.length.toString() : '10',
      width: parcel.width ? parcel.width.toString() : '10',
      as: '',
      subAccount: '',
      toTheOrderOf: '',
      skybillNumber: '',
      carrier: '1',
      skybillBackNumber: '',
      alternateProductCode: '',
      labelNumber: ''
    },
    skybillParamsValue: {
      duplicata: 'N',
      mode: 'PDF',
      withReservation: '2'
    },
    password: process.env.CHRONOPOST_PASSWORD,
    modeRetour: '2',
    numberOfParcel: '1',
    version: '2.0',
    multiParcel: 'N',
    scheduledValue: (productCode === '2R' || productCode === '2S') ? {
      expirationDate: calculatedExpirationDate || '',
      sellByDate: calculatedExpirationDate || ''
    } : null
  };
}

// ==================== ROUTES ====================

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Chronopost API',
    version: '1.0.0'
  });
});

// Endpoint principal : Créer une étiquette
app.post('/api/create-label', authenticateApiKey, async (req, res) => {
  try {
    console.log('📦 Nouvelle demande de création d\'étiquette');
    console.log('Commande:', req.body.orderNumber);

    // Validation des données
    const { orderNumber, recipient, parcel, shipDate } = req.body;

    if (!orderNumber || !recipient || !parcel || !shipDate) {
      return res.status(400).json({
        success: false,
        error: 'Données manquantes',
        details: 'orderNumber, recipient, parcel et shipDate sont requis'
      });
    }

    // Validation du destinataire
    if (!recipient.name || !recipient.address1 || !recipient.zipCode ||
        !recipient.city || !recipient.country || !recipient.email || !recipient.phone) {
      return res.status(400).json({
        success: false,
        error: 'Informations destinataire incomplètes',
        details: 'name, address1, zipCode, city, country, email, phone sont requis'
      });
    }

    // Validation du colis
    if (!parcel.weight || parcel.weight <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Poids du colis invalide',
        details: 'Le poids doit être supérieur à 0 (en kg)'
      });
    }

    // Construire la requête SOAP
    const soapRequest = buildSoapRequest(req.body);
    console.log('🔧 Requête SOAP construite');

    // Créer le client SOAP
    const client = await soap.createClientAsync(process.env.CHRONOPOST_WSDL_URL);
    console.log('🌐 Connexion au service Chronopost...');

    // Appeler la méthode shippingMultiParcelV4
    const [result] = await client.shippingMultiParcelV4Async(soapRequest);
    console.log('✅ Réponse reçue de Chronopost');

    // Vérifier les erreurs
    if (result.return && result.return.errorCode && result.return.errorCode !== '0') {
      console.error('❌ Erreur Chronopost:', result.return.errorMessage);
      return res.status(400).json({
        success: false,
        error: 'Erreur Chronopost',
        message: result.return.errorMessage,
        code: result.return.errorCode
      });
    }

    // Extraire les données de réponse
    const response = result.return;
    const reservationNumber = response.reservationNumber;

    // Les données du colis sont dans resultMultiParcelValue (c'est un tableau)
    const parcelResult = Array.isArray(response.resultMultiParcelValue)
      ? response.resultMultiParcelValue[0]
      : response.resultMultiParcelValue;

    const skybillNumber = parcelResult ? parcelResult.geoPostNumeroColis : null;
    const pdfLabel = parcelResult ? parcelResult.pdfEtiquette : null;

    console.log('📋 Étiquette créée:', skybillNumber);
    console.log('📄 PDF reçu:', pdfLabel ? 'Oui (' + pdfLabel.length + ' caractères)' : 'Non');

    // Retourner la réponse
    res.json({
      success: true,
      data: {
        skybillNumber: skybillNumber,
        reservationNumber: reservationNumber,
        pdfLabel: pdfLabel,
        trackingUrl: `https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT=${skybillNumber}`
      },
      orderNumber: orderNumber,
      createdAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erreur lors de la création de l\'étiquette:', error.message);
    console.error(error.stack);

    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Endpoint WooCommerce/Make : Créer une étiquette depuis données WordPress
app.post('/api/woocommerce/create-label', authenticateApiKey, async (req, res) => {
  try {
    console.log('🛒 Nouvelle commande WooCommerce reçue');
    console.log('Order ID:', req.body.order_id || req.body.id);

    // Transformer les données WooCommerce vers notre format
    const transformedData = transformWooCommerceData(req.body);
    console.log('📦 Données transformées pour commande:', transformedData.orderNumber);

    // Validation basique
    if (!transformedData.orderNumber) {
      return res.status(400).json({
        success: false,
        error: 'Numéro de commande manquant',
        details: 'order_id ou id est requis'
      });
    }

    if (!transformedData.recipient.address1 || !transformedData.recipient.zipCode ||
        !transformedData.recipient.city) {
      return res.status(400).json({
        success: false,
        error: 'Adresse de livraison incomplète',
        details: 'address_1, postcode et city sont requis dans shipping ou billing'
      });
    }

    if (!transformedData.recipient.email) {
      return res.status(400).json({
        success: false,
        error: 'Email manquant',
        details: 'billing.email ou billing_email est requis'
      });
    }

    // Construire la requête SOAP
    const soapRequest = buildSoapRequest(transformedData);
    console.log('🔧 Requête SOAP construite');

    // Créer le client SOAP
    const client = await soap.createClientAsync(process.env.CHRONOPOST_WSDL_URL);
    console.log('🌐 Connexion au service Chronopost...');

    // Appeler la méthode shippingMultiParcelV4
    const [result] = await client.shippingMultiParcelV4Async(soapRequest);
    console.log('✅ Réponse reçue de Chronopost');

    // Vérifier les erreurs
    if (result.return && result.return.errorCode && result.return.errorCode !== '0') {
      console.error('❌ Erreur Chronopost:', result.return.errorMessage);
      return res.status(400).json({
        success: false,
        error: 'Erreur Chronopost',
        message: result.return.errorMessage,
        code: result.return.errorCode,
        orderNumber: transformedData.orderNumber
      });
    }

    // Extraire les données de réponse
    const response = result.return;
    const reservationNumber = response.reservationNumber;

    const parcelResult = Array.isArray(response.resultMultiParcelValue)
      ? response.resultMultiParcelValue[0]
      : response.resultMultiParcelValue;

    const skybillNumber = parcelResult ? parcelResult.geoPostNumeroColis : null;
    const pdfLabel = parcelResult ? parcelResult.pdfEtiquette : null;

    console.log('📋 Étiquette créée:', skybillNumber);

    // Retourner la réponse enrichie pour Make
    res.json({
      success: true,
      data: {
        skybillNumber: skybillNumber,
        trackingNumber: skybillNumber,
        reservationNumber: reservationNumber,
        pdfLabel: pdfLabel,
        trackingUrl: `https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT=${skybillNumber}`
      },
      order: {
        orderNumber: transformedData.orderNumber,
        recipientName: transformedData.recipient.name,
        recipientEmail: transformedData.recipient.email,
        recipientCity: transformedData.recipient.city,
        weight: transformedData.parcel.weight
      },
      createdAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erreur lors de la création de l\'étiquette:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      message: error.message,
      orderNumber: req.body.order_id || req.body.id || 'inconnu'
    });
  }
});

// Route 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route non trouvée',
    availableEndpoints: [
      'GET /health',
      'POST /api/create-label',
      'POST /api/woocommerce/create-label'
    ]
  });
});

// Gestion globale des erreurs
app.use((err, req, res, next) => {
  console.error('❌ Erreur non gérée:', err);
  res.status(500).json({
    success: false,
    error: 'Erreur serveur interne',
    message: err.message
  });
});

// ==================== DÉMARRAGE DU SERVEUR ====================
// Démarrer le serveur seulement si ce fichier est exécuté directement
if (require.main === module) {
  app.listen(PORT, () => {
    console.log('');
    console.log('🚀 ========================================');
    console.log('🚀 API Chronopost démarrée !');
    console.log('🚀 ========================================');
    console.log(`🌐 URL: http://localhost:${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔑 API Key configurée: ${process.env.API_KEY ? '✅' : '❌'}`);
    console.log(`📦 Compte Chronopost: ${process.env.CHRONOPOST_ACCOUNT_NUMBER}`);
    console.log('🚀 ========================================');
    console.log('');
    console.log('📚 Endpoints disponibles:');
    console.log(`  - GET  ${process.env.NODE_ENV === 'production' ? 'https://votre-api.com' : `http://localhost:${PORT}`}/health`);
    console.log(`  - POST ${process.env.NODE_ENV === 'production' ? 'https://votre-api.com' : `http://localhost:${PORT}`}/api/create-label`);
    console.log(`  - POST ${process.env.NODE_ENV === 'production' ? 'https://votre-api.com' : `http://localhost:${PORT}`}/api/woocommerce/create-label`);
    console.log('');
  });
}

// Export pour les tests
module.exports = { app, buildSoapRequest, transformWooCommerceData };
