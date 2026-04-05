const nextJest = require('next/jest')

/** @type {import('jest').Config} */
const createJestConfig = nextJest({ dir: './' })

const config = {
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
}

module.exports = createJestConfig(config)
