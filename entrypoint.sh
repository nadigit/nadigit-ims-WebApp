#!/bin/sh

# Default values if not set
export ANGULAR_API_PROTOCOL="${ANGULAR_API_PROTOCOL:-http}"
export ANGULAR_API_HOST="${ANGULAR_API_HOST:-localhost}"
export ANGULAR_API_PORT="${ANGULAR_API_PORT:-8090}"
export ANGULAR_KC_HOST="${ANGULAR_KC_HOST:-localhost}"
export ANGULAR_KC_PORT="${ANGULAR_KC_PORT:-8080}"


# Create the environment.js file with substituted values
envsubst < /usr/share/nginx/html/assets/env.template.js > /usr/share/nginx/html/assets/environment.js


# Start Nginx server
nginx -g 'daemon off;'
