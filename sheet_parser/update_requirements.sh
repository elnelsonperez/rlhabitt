#!/bin/bash

# Script to update requirements.txt from Poetry dependencies

echo "Updating requirements.txt from Poetry dependencies..."

# Generate requirements.txt with all dependencies
poetry export -f requirements.txt --output requirements.txt --without-hashes

# Also generate a dev requirements file if needed
# poetry export -f requirements.txt --output requirements-dev.txt --without-hashes --with dev

echo "Requirements file updated successfully!"
echo "Location: $(pwd)/requirements.txt"

# Print the first few lines to confirm
echo ""
echo "First 5 dependencies:"
head -n 5 requirements.txt