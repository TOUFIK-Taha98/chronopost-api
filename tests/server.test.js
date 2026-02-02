const request = require('supertest');
const soap = require('soap');

// Mock soap module avant d'importer le serveur
jest.mock('soap');

const { app, buildSoapRequest, transformWooCommerceData } = require('../server');

// ==================== DONNÉES DE TEST ====================

const validRequestBody = {
  orderNumber: 'TEST-001',
  recipient: {
    name: 'Jean Dupont',
    address1: '123 Rue de la Liberté',
    address2: 'Appartement 5',
    zipCode: '69001',
    city: 'Lyon',
    country: 'FR',
    email: 'jean.dupont@example.com',
    phone: '0612345678'
  },
  parcel: {
    weight: 2.5,
    length: 30,
    width: 20,
    height: 15
  },
  productCode: '5N',
  service: '0',
  shipDate: '2026-02-01'
};

const mockChronopostSuccessResponse = {
  return: {
    errorCode: '0',
    errorMessage: null,
    reservationNumber: '88895048215708670',
    resultMultiParcelValue: [{
      geoPostNumeroColis: 'XY504821570VF',
      pdfEtiquette: 'JVBERi0xLjQKJeLjz9MKMyAwIG9iago8PAovTGVuZ3RoIDQ='
    }]
  }
};

const mockChronopostErrorResponse = {
  return: {
    errorCode: '3',
    errorMessage: 'Adresse invalide'
  }
};

// ==================== TESTS DU HEALTH CHECK ====================

describe('GET /health', () => {
  test('devrait retourner le statut OK', async () => {
    const response = await request(app)
      .get('/health')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      status: 'ok',
      service: 'Chronopost API',
      version: '1.0.0'
    });
    expect(response.body.timestamp).toBeDefined();
  });
});

// ==================== TESTS D'AUTHENTIFICATION ====================

describe('Authentification API Key', () => {
  test('devrait rejeter une requête sans API Key', async () => {
    const response = await request(app)
      .post('/api/create-label')
      .send(validRequestBody)
      .expect('Content-Type', /json/)
      .expect(401);

    expect(response.body).toMatchObject({
      success: false,
      error: 'API Key invalide ou manquante'
    });
  });

  test('devrait rejeter une requête avec une mauvaise API Key', async () => {
    const response = await request(app)
      .post('/api/create-label')
      .set('X-API-Key', 'wrong-api-key')
      .send(validRequestBody)
      .expect(401);

    expect(response.body).toMatchObject({
      success: false,
      error: 'API Key invalide ou manquante'
    });
  });

  test('devrait accepter une requête avec la bonne API Key', async () => {
    // Setup mock pour ce test
    const mockClient = {
      shippingMultiParcelV4Async: jest.fn().mockResolvedValue([mockChronopostSuccessResponse])
    };
    soap.createClientAsync.mockResolvedValue(mockClient);

    const response = await request(app)
      .post('/api/create-label')
      .set('X-API-Key', 'test-api-key-12345')
      .send(validRequestBody)
      .expect(200);

    expect(response.body.success).toBe(true);
  });
});

// ==================== TESTS DE VALIDATION DES DONNÉES ====================

describe('POST /api/create-label - Validation', () => {
  const apiKey = 'test-api-key-12345';

  test('devrait rejeter une requête sans orderNumber', async () => {
    const invalidBody = { ...validRequestBody };
    delete invalidBody.orderNumber;

    const response = await request(app)
      .post('/api/create-label')
      .set('X-API-Key', apiKey)
      .send(invalidBody)
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      error: 'Données manquantes'
    });
  });

  test('devrait rejeter une requête sans recipient', async () => {
    const invalidBody = { ...validRequestBody };
    delete invalidBody.recipient;

    const response = await request(app)
      .post('/api/create-label')
      .set('X-API-Key', apiKey)
      .send(invalidBody)
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      error: 'Données manquantes'
    });
  });

  test('devrait rejeter une requête sans parcel', async () => {
    const invalidBody = { ...validRequestBody };
    delete invalidBody.parcel;

    const response = await request(app)
      .post('/api/create-label')
      .set('X-API-Key', apiKey)
      .send(invalidBody)
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      error: 'Données manquantes'
    });
  });

  test('devrait rejeter une requête sans shipDate', async () => {
    const invalidBody = { ...validRequestBody };
    delete invalidBody.shipDate;

    const response = await request(app)
      .post('/api/create-label')
      .set('X-API-Key', apiKey)
      .send(invalidBody)
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      error: 'Données manquantes'
    });
  });

  test('devrait rejeter un destinataire sans nom', async () => {
    const invalidBody = {
      ...validRequestBody,
      recipient: { ...validRequestBody.recipient, name: '' }
    };

    const response = await request(app)
      .post('/api/create-label')
      .set('X-API-Key', apiKey)
      .send(invalidBody)
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      error: 'Informations destinataire incomplètes'
    });
  });

  test('devrait rejeter un destinataire sans email', async () => {
    const invalidBody = {
      ...validRequestBody,
      recipient: { ...validRequestBody.recipient }
    };
    delete invalidBody.recipient.email;

    const response = await request(app)
      .post('/api/create-label')
      .set('X-API-Key', apiKey)
      .send(invalidBody)
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      error: 'Informations destinataire incomplètes'
    });
  });

  test('devrait rejeter un colis sans poids', async () => {
    const invalidBody = {
      ...validRequestBody,
      parcel: { ...validRequestBody.parcel }
    };
    delete invalidBody.parcel.weight;

    const response = await request(app)
      .post('/api/create-label')
      .set('X-API-Key', apiKey)
      .send(invalidBody)
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      error: 'Poids du colis invalide'
    });
  });

  test('devrait rejeter un colis avec poids négatif', async () => {
    const invalidBody = {
      ...validRequestBody,
      parcel: { ...validRequestBody.parcel, weight: -1 }
    };

    const response = await request(app)
      .post('/api/create-label')
      .set('X-API-Key', apiKey)
      .send(invalidBody)
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      error: 'Poids du colis invalide'
    });
  });

  test('devrait rejeter un colis avec poids = 0', async () => {
    const invalidBody = {
      ...validRequestBody,
      parcel: { ...validRequestBody.parcel, weight: 0 }
    };

    const response = await request(app)
      .post('/api/create-label')
      .set('X-API-Key', apiKey)
      .send(invalidBody)
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      error: 'Poids du colis invalide'
    });
  });
});

// ==================== TESTS DE CRÉATION D'ÉTIQUETTE ====================

describe('POST /api/create-label - Création réussie', () => {
  const apiKey = 'test-api-key-12345';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('devrait créer une étiquette avec succès', async () => {
    const mockClient = {
      shippingMultiParcelV4Async: jest.fn().mockResolvedValue([mockChronopostSuccessResponse])
    };
    soap.createClientAsync.mockResolvedValue(mockClient);

    const response = await request(app)
      .post('/api/create-label')
      .set('X-API-Key', apiKey)
      .send(validRequestBody)
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      orderNumber: 'TEST-001'
    });
    expect(response.body.data).toMatchObject({
      skybillNumber: 'XY504821570VF',
      reservationNumber: '88895048215708670',
      trackingUrl: 'https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT=XY504821570VF'
    });
    expect(response.body.data.pdfLabel).toBeDefined();
    expect(response.body.createdAt).toBeDefined();
  });

  test('devrait appeler le service SOAP avec les bonnes données', async () => {
    const mockClient = {
      shippingMultiParcelV4Async: jest.fn().mockResolvedValue([mockChronopostSuccessResponse])
    };
    soap.createClientAsync.mockResolvedValue(mockClient);

    await request(app)
      .post('/api/create-label')
      .set('X-API-Key', apiKey)
      .send(validRequestBody)
      .expect(200);

    expect(soap.createClientAsync).toHaveBeenCalledWith(process.env.CHRONOPOST_WSDL_URL);
    expect(mockClient.shippingMultiParcelV4Async).toHaveBeenCalled();

    const soapArgs = mockClient.shippingMultiParcelV4Async.mock.calls[0][0];
    expect(soapArgs.recipientValue.recipientName).toBe('Jean Dupont');
    expect(soapArgs.recipientValue.recipientCity).toBe('Lyon');
    expect(soapArgs.skybillValue.weight).toBe('2.5');
    expect(soapArgs.skybillValue.productCode).toBe('5N');
    expect(soapArgs.refValue.shipperRef).toBe('TEST-001');
  });

  test('devrait utiliser les valeurs par défaut pour productCode et service', async () => {
    const mockClient = {
      shippingMultiParcelV4Async: jest.fn().mockResolvedValue([mockChronopostSuccessResponse])
    };
    soap.createClientAsync.mockResolvedValue(mockClient);

    const bodyWithoutDefaults = {
      orderNumber: 'TEST-002',
      recipient: validRequestBody.recipient,
      parcel: validRequestBody.parcel,
      shipDate: '2026-02-01'
    };

    await request(app)
      .post('/api/create-label')
      .set('X-API-Key', apiKey)
      .send(bodyWithoutDefaults)
      .expect(200);

    const soapArgs = mockClient.shippingMultiParcelV4Async.mock.calls[0][0];
    expect(soapArgs.skybillValue.productCode).toBe('5N');
    expect(soapArgs.skybillValue.service).toBe('0');
  });

  test('devrait gérer les dimensions optionnelles du colis', async () => {
    const mockClient = {
      shippingMultiParcelV4Async: jest.fn().mockResolvedValue([mockChronopostSuccessResponse])
    };
    soap.createClientAsync.mockResolvedValue(mockClient);

    const bodyWithoutDimensions = {
      ...validRequestBody,
      parcel: { weight: 1.5 }
    };

    await request(app)
      .post('/api/create-label')
      .set('X-API-Key', apiKey)
      .send(bodyWithoutDimensions)
      .expect(200);

    const soapArgs = mockClient.shippingMultiParcelV4Async.mock.calls[0][0];
    expect(soapArgs.skybillValue.height).toBe('10');
    expect(soapArgs.skybillValue.length).toBe('10');
    expect(soapArgs.skybillValue.width).toBe('10');
  });
});

// ==================== TESTS DE GESTION DES ERREURS ====================

describe('POST /api/create-label - Gestion des erreurs', () => {
  const apiKey = 'test-api-key-12345';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('devrait gérer les erreurs Chronopost', async () => {
    const mockClient = {
      shippingMultiParcelV4Async: jest.fn().mockResolvedValue([mockChronopostErrorResponse])
    };
    soap.createClientAsync.mockResolvedValue(mockClient);

    const response = await request(app)
      .post('/api/create-label')
      .set('X-API-Key', apiKey)
      .send(validRequestBody)
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      error: 'Erreur Chronopost',
      message: 'Adresse invalide',
      code: '3'
    });
  });

  test('devrait gérer les erreurs de connexion SOAP', async () => {
    soap.createClientAsync.mockRejectedValue(new Error('Connexion impossible'));

    const response = await request(app)
      .post('/api/create-label')
      .set('X-API-Key', apiKey)
      .send(validRequestBody)
      .expect(500);

    expect(response.body).toMatchObject({
      success: false,
      error: 'Erreur serveur',
      message: 'Connexion impossible'
    });
  });

  test('devrait gérer les erreurs lors de l\'appel SOAP', async () => {
    const mockClient = {
      shippingMultiParcelV4Async: jest.fn().mockRejectedValue(new Error('Timeout'))
    };
    soap.createClientAsync.mockResolvedValue(mockClient);

    const response = await request(app)
      .post('/api/create-label')
      .set('X-API-Key', apiKey)
      .send(validRequestBody)
      .expect(500);

    expect(response.body).toMatchObject({
      success: false,
      error: 'Erreur serveur',
      message: 'Timeout'
    });
  });
});

// ==================== TESTS DE LA FONCTION buildSoapRequest ====================

describe('buildSoapRequest', () => {
  test('devrait construire une requête SOAP valide', () => {
    const result = buildSoapRequest(validRequestBody);

    expect(result.headerValue).toBeDefined();
    expect(result.headerValue.accountNumber).toBe(process.env.CHRONOPOST_ACCOUNT_NUMBER);

    expect(result.shipperValue).toBeDefined();
    expect(result.shipperValue.shipperName).toBe(process.env.SHIPPER_NAME);
    expect(result.shipperValue.shipperCity).toBe(process.env.SHIPPER_CITY);

    expect(result.recipientValue).toBeDefined();
    expect(result.recipientValue.recipientName).toBe('Jean Dupont');
    expect(result.recipientValue.recipientCity).toBe('Lyon');
    expect(result.recipientValue.recipientZipCode).toBe('69001');

    expect(result.skybillValue).toBeDefined();
    expect(result.skybillValue.weight).toBe('2.5');
    expect(result.skybillValue.productCode).toBe('5N');
    expect(result.skybillValue.service).toBe('0');

    expect(result.password).toBe(process.env.CHRONOPOST_PASSWORD);
  });

  test('devrait gérer l\'adresse2 optionnelle', () => {
    const bodyWithoutAddress2 = {
      ...validRequestBody,
      recipient: { ...validRequestBody.recipient }
    };
    delete bodyWithoutAddress2.recipient.address2;

    const result = buildSoapRequest(bodyWithoutAddress2);
    expect(result.recipientValue.recipientAdress2).toBe('');
  });

  test('devrait utiliser FRANCE comme nom de pays pour FR', () => {
    const result = buildSoapRequest(validRequestBody);
    expect(result.shipperValue.shipperCountryName).toBe('FRANCE');
  });

  test('devrait gérer les pays non-FR', () => {
    process.env.SHIPPER_COUNTRY = 'BE';
    const result = buildSoapRequest(validRequestBody);
    expect(result.shipperValue.shipperCountryName).toBe('BE');
    process.env.SHIPPER_COUNTRY = 'FR'; // Reset
  });
});

// ==================== TESTS ROUTE 404 ====================

describe('Route 404', () => {
  test('devrait retourner 404 pour une route inexistante', async () => {
    const response = await request(app)
      .get('/nonexistent')
      .expect(404);

    expect(response.body).toMatchObject({
      success: false,
      error: 'Route non trouvée'
    });
    expect(response.body.availableEndpoints).toContain('GET /health');
    expect(response.body.availableEndpoints).toContain('POST /api/create-label');
  });

  test('devrait retourner 404 pour une méthode HTTP incorrecte', async () => {
    const response = await request(app)
      .get('/api/create-label')
      .expect(404);

    expect(response.body.success).toBe(false);
  });
});

// ==================== TESTS DE RÉPONSES CHRONOPOST VARIÉES ====================

describe('POST /api/create-label - Réponses Chronopost variées', () => {
  const apiKey = 'test-api-key-12345';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('devrait gérer une réponse sans tableau resultMultiParcelValue', async () => {
    const singleParcelResponse = {
      return: {
        errorCode: '0',
        reservationNumber: '123456',
        resultMultiParcelValue: {
          geoPostNumeroColis: 'XY123456',
          pdfEtiquette: 'BASE64PDF'
        }
      }
    };

    const mockClient = {
      shippingMultiParcelV4Async: jest.fn().mockResolvedValue([singleParcelResponse])
    };
    soap.createClientAsync.mockResolvedValue(mockClient);

    const response = await request(app)
      .post('/api/create-label')
      .set('X-API-Key', apiKey)
      .send(validRequestBody)
      .expect(200);

    expect(response.body.data.skybillNumber).toBe('XY123456');
  });

  test('devrait gérer errorCode = 0 comme succès', async () => {
    const successResponse = {
      return: {
        errorCode: '0',
        errorMessage: '',
        reservationNumber: '789',
        resultMultiParcelValue: [{
          geoPostNumeroColis: 'XY789',
          pdfEtiquette: 'PDF'
        }]
      }
    };

    const mockClient = {
      shippingMultiParcelV4Async: jest.fn().mockResolvedValue([successResponse])
    };
    soap.createClientAsync.mockResolvedValue(mockClient);

    const response = await request(app)
      .post('/api/create-label')
      .set('X-API-Key', apiKey)
      .send(validRequestBody)
      .expect(200);

    expect(response.body.success).toBe(true);
  });
});

// ==================== TESTS TRANSFORMATION WOOCOMMERCE ====================

const validWooCommerceData = {
  order_id: '12345',
  billing: {
    first_name: 'Marie',
    last_name: 'Martin',
    email: 'marie@example.com',
    phone: '0698765432',
    address_1: '45 Avenue des Champs',
    address_2: '3eme etage',
    city: 'Paris',
    postcode: '75008',
    country: 'FR'
  },
  shipping: {
    first_name: 'Marie',
    last_name: 'Martin',
    address_1: '45 Avenue des Champs',
    address_2: '3eme etage',
    city: 'Paris',
    postcode: '75008',
    country: 'FR',
    phone: '0698765432'
  },
  line_items: [
    { name: 'Produit A', quantity: 2, weight: '0.5' },
    { name: 'Produit B', quantity: 1, weight: '1.2' }
  ],
  total_weight: 2.2
};

describe('transformWooCommerceData', () => {
  test('devrait transformer les donnees WooCommerce correctement', () => {
    const result = transformWooCommerceData(validWooCommerceData);

    expect(result.orderNumber).toBe('12345');
    expect(result.recipient.name).toBe('Marie Martin');
    expect(result.recipient.address1).toBe('45 Avenue des Champs');
    expect(result.recipient.city).toBe('Paris');
    expect(result.recipient.zipCode).toBe('75008');
    expect(result.recipient.email).toBe('marie@example.com');
    expect(result.parcel.weight).toBe(2.2);
  });

  test('devrait utiliser billing si shipping est absent', () => {
    const dataWithoutShipping = {
      order_id: '999',
      billing: {
        first_name: 'Jean',
        last_name: 'Test',
        email: 'jean@test.com',
        phone: '0612345678',
        address_1: '1 Rue Test',
        city: 'Lyon',
        postcode: '69001',
        country: 'FR'
      }
    };

    const result = transformWooCommerceData(dataWithoutShipping);
    expect(result.recipient.name).toBe('Jean Test');
    expect(result.recipient.city).toBe('Lyon');
  });

  test('devrait calculer le poids depuis line_items', () => {
    const dataWithItems = {
      order_id: '888',
      billing: { first_name: 'Test', last_name: 'User', email: 't@t.com', address_1: 'A', city: 'B', postcode: '12345', country: 'FR' },
      line_items: [
        { quantity: 2, weight: '1.0' },
        { quantity: 3, weight: '0.5' }
      ]
    };

    const result = transformWooCommerceData(dataWithItems);
    expect(result.parcel.weight).toBe(3.5); // 2*1.0 + 3*0.5
  });

  test('devrait utiliser le poids par defaut si pas de line_items', () => {
    const dataWithoutWeight = {
      order_id: '777',
      billing: { first_name: 'A', last_name: 'B', email: 'a@b.com', address_1: 'X', city: 'Y', postcode: '12345', country: 'FR' }
    };

    const result = transformWooCommerceData(dataWithoutWeight);
    expect(result.parcel.weight).toBe(0.5);
  });

  test('devrait accepter id ou number comme order_id', () => {
    const dataWithId = { id: '111', billing: { first_name: 'A', last_name: 'B', email: 'a@b.com', address_1: 'X', city: 'Y', postcode: '12345', country: 'FR' } };
    const dataWithNumber = { number: '222', billing: { first_name: 'A', last_name: 'B', email: 'a@b.com', address_1: 'X', city: 'Y', postcode: '12345', country: 'FR' } };

    expect(transformWooCommerceData(dataWithId).orderNumber).toBe('111');
    expect(transformWooCommerceData(dataWithNumber).orderNumber).toBe('222');
  });

  test('devrait generer une date d envoi si non fournie', () => {
    const dataWithoutDate = {
      order_id: '666',
      billing: { first_name: 'A', last_name: 'B', email: 'a@b.com', address_1: 'X', city: 'Y', postcode: '12345', country: 'FR' }
    };

    const result = transformWooCommerceData(dataWithoutDate);
    expect(result.shipDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('devrait utiliser ship_date si fourni', () => {
    const dataWithDate = {
      order_id: '555',
      billing: { first_name: 'A', last_name: 'B', email: 'a@b.com', address_1: 'X', city: 'Y', postcode: '12345', country: 'FR' },
      ship_date: '2026-03-15'
    };

    const result = transformWooCommerceData(dataWithDate);
    expect(result.shipDate).toBe('2026-03-15');
  });
});

// ==================== TESTS ENDPOINT WOOCOMMERCE ====================

describe('POST /api/woocommerce/create-label', () => {
  const apiKey = 'test-api-key-12345';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('devrait rejeter sans API Key', async () => {
    const response = await request(app)
      .post('/api/woocommerce/create-label')
      .send(validWooCommerceData)
      .expect(401);

    expect(response.body.success).toBe(false);
  });

  test('devrait rejeter sans order_id', async () => {
    const dataWithoutId = { ...validWooCommerceData };
    delete dataWithoutId.order_id;
    delete dataWithoutId.id;
    delete dataWithoutId.number;

    const response = await request(app)
      .post('/api/woocommerce/create-label')
      .set('X-API-Key', apiKey)
      .send(dataWithoutId)
      .expect(400);

    expect(response.body.error).toBe('Numéro de commande manquant');
  });

  test('devrait rejeter sans adresse', async () => {
    const dataWithoutAddress = {
      order_id: '12345',
      billing: { email: 'test@test.com' }
    };

    const response = await request(app)
      .post('/api/woocommerce/create-label')
      .set('X-API-Key', apiKey)
      .send(dataWithoutAddress)
      .expect(400);

    expect(response.body.error).toBe('Adresse de livraison incomplète');
  });

  test('devrait rejeter sans email', async () => {
    const dataWithoutEmail = {
      order_id: '12345',
      billing: {
        first_name: 'Test',
        address_1: '123 Rue',
        city: 'Paris',
        postcode: '75001',
        country: 'FR'
      }
    };

    const response = await request(app)
      .post('/api/woocommerce/create-label')
      .set('X-API-Key', apiKey)
      .send(dataWithoutEmail)
      .expect(400);

    expect(response.body.error).toBe('Email manquant');
  });

  test('devrait creer une etiquette avec succes', async () => {
    const mockClient = {
      shippingMultiParcelV4Async: jest.fn().mockResolvedValue([mockChronopostSuccessResponse])
    };
    soap.createClientAsync.mockResolvedValue(mockClient);

    const response = await request(app)
      .post('/api/woocommerce/create-label')
      .set('X-API-Key', apiKey)
      .send(validWooCommerceData)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.skybillNumber).toBe('XY504821570VF');
    expect(response.body.data.trackingNumber).toBe('XY504821570VF');
    expect(response.body.order.orderNumber).toBe('12345');
    expect(response.body.order.recipientName).toBe('Marie Martin');
  });

  test('devrait gerer les erreurs Chronopost', async () => {
    const mockClient = {
      shippingMultiParcelV4Async: jest.fn().mockResolvedValue([mockChronopostErrorResponse])
    };
    soap.createClientAsync.mockResolvedValue(mockClient);

    const response = await request(app)
      .post('/api/woocommerce/create-label')
      .set('X-API-Key', apiKey)
      .send(validWooCommerceData)
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Erreur Chronopost');
    expect(response.body.orderNumber).toBe('12345');
  });
});
