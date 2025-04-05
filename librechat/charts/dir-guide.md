# Charts Directory Guide

## Overview

The `charts` directory contains Helm charts used for deploying LibreChat to Kubernetes environments. Helm is a package manager for Kubernetes that allows defining, installing, and upgrading complex Kubernetes applications through charts - packages of pre-configured Kubernetes resources.

## Directory Structure

- `charts/librechat/` - The main Helm chart for deploying LibreChat
  - `Chart.yaml` - Metadata about the chart (name, version, description)
  - `values.yaml` - Default configuration values for the chart
  - `templates/` - Kubernetes resource templates that are rendered based on values
    - `deployment.yaml` - Defines the LibreChat application deployment
    - `service.yaml` - Exposes the application as a network service
    - `ingress.yaml` - Manages external access to the service
    - `hpa.yaml` - Horizontal Pod Autoscaler for scaling based on load
    - `configmap.yaml` - Stores configuration data separated from code
    - `secret.yaml` - Securely stores sensitive information like credentials
    - `_helpers.tpl` - Contains template helpers used across other template files

## Purpose and Usage

The Helm chart in this directory serves several key purposes:

1. **Containerized Deployment** - Provides a standardized way to deploy LibreChat in container orchestration environments
2. **Environment Configuration** - Allows for environment-specific configuration through values overrides
3. **Resource Management** - Defines all necessary Kubernetes resources for running the application
4. **Scaling and Resilience** - Configures auto-scaling and high availability features
5. **Production Readiness** - Implements best practices for production Kubernetes deployments

## Integration with Other Components

The charts directory integrates with other parts of the LibreChat application in the following ways:

### Integration with API

- The deployment templates reference the API container images
- Environment variables and configuration settings required by the API are defined in ConfigMaps and Secrets
- Service definitions expose the API endpoints for client access

### Integration with Config

- The chart's `values.yaml` provides defaults that can be overridden for different environments
- Configuration from the `config` directory may be mapped into the containers via ConfigMaps
- Environment-specific settings are separated from application code through Kubernetes resources

### Integration with Client

- The deployment may include the client as a separate container or as part of a combined image
- Ingress resources are configured to route traffic appropriately to frontend and backend services

## Deployment Workflow

1. The chart is customized through values files (e.g., `values-prod.yaml`, `values-staging.yaml`)
2. Helm renders the templates with the specified values to create Kubernetes manifests
3. Kubernetes applies these manifests to create/update resources in the cluster
4. The application becomes available through the defined service and ingress endpoints

## Key Configuration Options

The `values.yaml` file contains customizable parameters for the deployment, including:

- Container image and version
- Replica count for scaling
- Resource requests and limits
- Environment variables
- Persistent storage configuration
- Ingress settings for external access

## Best Practices

- Use version control for chart changes
- Test changes in a staging environment before deploying to production
- Use separate values files for different environments
- Document all custom values for each deployment
- Consider using Helm secrets or external secrets management for sensitive data

By following these practices, the charts directory provides a robust, repeatable way to deploy LibreChat across different Kubernetes environments.

