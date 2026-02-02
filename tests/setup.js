// Configuration des variables d'environnement pour les tests
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.API_KEY = 'test-api-key-12345';
process.env.CHRONOPOST_ACCOUNT_NUMBER = '19869502';
process.env.CHRONOPOST_PASSWORD = '255562';
process.env.CHRONOPOST_WSDL_URL = 'https://ws.chronopost.fr/shipping-cxf/ShippingServiceWS?wsdl';
process.env.SHIPPER_NAME = 'Test Shop';
process.env.SHIPPER_ADDRESS1 = '123 Rue de Test';
process.env.SHIPPER_ADDRESS2 = '';
process.env.SHIPPER_CITY = 'Paris';
process.env.SHIPPER_ZIPCODE = '75001';
process.env.SHIPPER_COUNTRY = 'FR';
process.env.SHIPPER_EMAIL = 'test@example.com';
process.env.SHIPPER_PHONE = '0102030405';
process.env.SHIPPER_CONTACT_NAME = 'Service Test';

// Désactiver les logs console pendant les tests
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});
