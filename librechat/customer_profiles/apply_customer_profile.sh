#!/bin/bash

# Colors for output formatting
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Function to print error message and exit
error_exit() {
    echo -e "${RED}ERROR: $1${NC}"
    exit 1
}

# Function to print success message
success_msg() {
    echo -e "${GREEN}$1${NC}"
}

# Function to print info message
info_msg() {
    echo -e "${YELLOW}$1${NC}"
}

# Check if company name is provided
if [ $# -ne 1 ]; then
    error_exit "Company name not provided. Usage: $0 <company_name>"
fi

COMPANY_NAME=$1
CUSTOMER_DIR="customer_profiles/${COMPANY_NAME}"

# Check if customer directory exists
if [ ! -d "${CUSTOMER_DIR}" ]; then
    error_exit "Customer directory '${CUSTOMER_DIR}' does not exist."
fi

info_msg "Applying profile for customer: ${COMPANY_NAME}"

# Check if .env file exists in customer directory
if [ ! -f "${CUSTOMER_DIR}/.env" ]; then
    error_exit "File '.env' not found in ${CUSTOMER_DIR}"
fi

# Check if librechat.yaml file exists in customer directory
if [ ! -f "${CUSTOMER_DIR}/librechat.yaml" ]; then
    error_exit "File 'librechat.yaml' not found in ${CUSTOMER_DIR}"
fi

# Backup existing files if they exist
if [ -f ".env" ]; then
    info_msg "Backing up existing .env file to .env.backup"
    cp .env .env.backup || error_exit "Failed to backup .env file"
fi

if [ -f "librechat.yaml" ]; then
    info_msg "Backing up existing librechat.yaml file to librechat.yaml.backup"
    cp librechat.yaml librechat.yaml.backup || error_exit "Failed to backup librechat.yaml file"
fi

# Copy .env file
info_msg "Copying .env file from ${CUSTOMER_DIR} to current directory..."
cp "${CUSTOMER_DIR}/.env" ./ || error_exit "Failed to copy .env file"

# Copy librechat.yaml file
info_msg "Copying librechat.yaml file from ${CUSTOMER_DIR} to current directory..."
cp "${CUSTOMER_DIR}/librechat.yaml" ./ || error_exit "Failed to copy librechat.yaml file"

success_msg "Successfully applied configuration for customer: ${COMPANY_NAME}"
success_msg "Files copied:"
success_msg "  - .env"
success_msg "  - librechat.yaml"

exit 0

