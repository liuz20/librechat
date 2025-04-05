# End-to-End Testing Directory Guide

## Overview

The `e2e` directory contains all the end-to-end testing infrastructure for LibreChat. End-to-end (E2E) tests verify that the entire application works correctly by simulating real user interactions, testing the flow of data from the frontend all the way to the backend and back again.

These tests ensure that all components of LibreChat work together seamlessly from a user's perspective, verifying functionality across the entire stack including:

- Frontend UI components
- API endpoints
- Database interactions
- External service integrations
- Authentication flows
- Chat functionality

## Directory Structure

The e2e directory is organized as follows:

```
e2e/
├── specs/           # Test specification files organized by feature/functionality
├── setup/           # Setup and configuration files for the testing environment
├── config/          # Test configuration options
├── utils/           # Helper utilities for tests
└── fixtures/        # Test data fixtures
```

## Test Specifications

The `specs` directory contains the actual test files written in TypeScript using a testing framework (likely Playwright or Cypress). These tests are organized by feature or functionality and simulate user interactions with the application.

Examples of test specifications include:
- Authentication tests (login, registration, password reset)
- Conversation tests (sending messages, receiving responses)
- UI element tests (sidebar, settings panel, chat interface)
- Model switching and configuration tests
- File upload/attachment tests
- API integration tests

Each test file typically contains multiple test cases that verify specific behaviors or user flows.

## Setup and Configuration

The `setup` directory contains scripts and configuration files needed to prepare the testing environment before tests run. This includes:

- Browser configuration
- Test user creation
- Database seeding
- Mock service setup
- Environment variable configuration

The `config` directory contains configuration options for different test environments (development, staging, production) and test runners.

## Test Utilities

The `utils` directory provides helper functions and utilities used across multiple test files, including:

- Custom test assertions
- Helper functions for common operations
- Page object models (representations of UI pages/components)
- API client wrappers
- Authentication helpers
- Test data generators

## Running the Tests

E2E tests can be run using npm scripts defined in the project's package.json:

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test suites
npm run test:e2e:auth
npm run test:e2e:chat
```

## Continuous Integration

These E2E tests are integrated with the project's CI/CD pipeline to ensure that all changes to the codebase are automatically tested before deployment. This helps catch regressions and ensures consistent functionality across releases.

## Best Practices

When adding or modifying E2E tests:

1. Keep tests isolated and independent from each other
2. Use descriptive test names that explain what is being tested
3. Clean up any test data after test completion
4. Minimize dependencies on external services when possible
5. Structure tests to match user flows and behaviors
6. Prioritize testing critical user paths and functionality

## Relation to Other Directories

The E2E tests interact with both the `client` and `api` components:

- They load and test the React application from the `client` directory
- They make requests to endpoints defined in the `api` directory
- They use configuration from the `config` directory for test environments

These tests serve as the final verification that all LibreChat components work together correctly, providing confidence that the application functions as expected from a user's perspective.

