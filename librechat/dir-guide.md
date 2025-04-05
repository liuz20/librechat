# LibreChat Project Structure Guide

This document provides an overview of the LibreChat project structure, explaining the purpose of each main directory and how they work together to form the complete application architecture.

## Directory Overview

### 📁 `api/`

The API directory contains the backend server implementation for LibreChat. It handles:

- Communication with various AI model providers (OpenAI, Anthropic, Google, etc.)
- Database operations and persistence
- Authentication and user management
- Request routing and middleware
- Business logic and service implementations

The API serves as the core backend that processes requests from the client application and communicates with external AI services.

### 📁 `charts/`

The charts directory contains Helm charts for Kubernetes deployment of LibreChat. This enables:

- Containerized deployment in Kubernetes environments
- Scalable infrastructure configuration
- Defined deployment templates for services, ingress, and resources
- Configuration management for different deployment environments

These Helm charts provide a standardized way to deploy LibreChat in container orchestration environments.

### 📁 `client/`

The client directory houses the frontend React application that users interact with. It includes:

- React components for the user interface
- State management
- API communication layers
- Styling with Tailwind CSS
- User experience features

The client provides a ChatGPT-like interface for interacting with various AI models through the LibreChat backend.

### 📁 `config/`

The config directory manages application configuration across the project:

- Environment variable definitions
- Configuration scripts
- Internationalization and translation files
- Setup scripts and utilities

Configuration settings control which features are enabled, which AI providers are available, and how the application behaves in different environments.

### 📁 `e2e/`

The e2e (end-to-end) directory contains automated tests to verify the full functionality of LibreChat:

- Integration tests
- User flow testing
- Frontend and backend interaction verification
- Test utilities and configurations

These tests ensure that the complete application works correctly from the user interface through to the backend services.

### 📁 `utils/`

The utils directory provides shared utility functions and helper scripts used across the project:

- Common utility methods
- Shared code between frontend and backend
- Helper scripts for development and deployment
- Miscellaneous tools

These utilities support the development, testing, and operation of LibreChat.

## How Components Work Together

LibreChat's architecture follows a client-server model:

1. The **client** application provides the user interface that communicates with the **api** backend through HTTP requests.

2. The **api** backend processes these requests, interacts with AI service providers, and manages data persistence.

3. The **config** directory provides configuration settings used by both the client and API components.

4. The **charts** directory enables deployment of both client and API components in container orchestration environments.

5. The **e2e** tests verify that the client and API components work together correctly.

6. The **utils** directory provides shared functionality used across multiple components.

This modular architecture allows LibreChat to support multiple AI providers while maintaining a consistent user experience across different deployment environments.

## Further Documentation

Each directory contains its own `dir-guide.md` file that provides more detailed information about its specific structure and functionality.

# LibreChat Directory Structure Guide

This document provides an overview of LibreChat's top-level directories and their purposes within the project architecture.

## Top-Level Directories

### api/
The core backend of LibreChat, responsible for handling requests from the client, interacting with various AI model providers (like OpenAI, Anthropic, etc.), and managing data persistence. It contains server implementation, models, middleware, and utility functions for the application's server-side operations.

### charts/
Contains deployment configuration for container orchestration, likely using Helm charts. This directory handles packaging and deployment aspects of LibreChat, making it easier to deploy in Kubernetes or other container environments.

### client/
The frontend codebase that provides LibreChat's user interface. Built with modern web technologies, it communicates with the API to render the chat interface, manage user interactions, and display AI responses. Contains components, hooks, state management, and routing logic.

### config/
Houses configuration files and environment variable definitions that control LibreChat's behavior across different deployment environments. This includes API keys, feature flags, model settings, and other configuration parameters used by both frontend and backend.

### e2e/
Contains end-to-end testing infrastructure to validate that the complete application works correctly. These tests simulate user interactions to ensure that the frontend and backend work together as expected across the application's critical paths.

### utils/
Provides shared utility functions and helper libraries that are used by multiple parts of the application. These are typically common operations or data handling routines that don't logically belong to just the frontend or backend.

## Interrelationships

- **Core Application Flow**: The `client` directory contains the user interface that sends requests to the `api`, which processes these requests, communicates with AI providers, and returns responses.

- **Configuration Management**: The `config` directory provides settings consumed by both `api` and `client` to control behavior, feature availability, and external service connections.

- **Deployment Pipeline**: The `charts` directory enables containerized deployment of the components defined in the `api` and `client` directories.

- **Quality Assurance**: The `e2e` directory contains tests that validate the integration between `client` and `api` to ensure the application functions correctly as a whole.

- **Shared Functionality**: The `utils` directory contains code used by multiple other directories, providing common functionality without duplication.

Together, these directories form a full-stack application where:
- `api` and `client` form the core application components
- `config` manages the application's settings and environment variables
- `charts` handles deployment concerns
- `e2e` ensures quality through automated testing
- `utils` provides shared code across components

This modular structure allows for separation of concerns while maintaining clear relationships between the different parts of the application.

