module.exports = {
  testEnvironment: 'node',
  verbose: true,
  collectCoverageFrom: ['server.js'],
  coverageDirectory: 'coverage',
  testMatch: ['**/*.test.js'],
  setupFilesAfterEnv: ['./tests/setup.js']
};
