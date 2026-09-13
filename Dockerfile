# Stage 1: Compile and Build Angular codebase
# Node 18 is end of support, and Angular 20 (see docs/ANGULAR_UPGRADE_PLAN.md in the server repo)
# will not build on it. Pinned to a major so a rebuild cannot silently move underneath us.
FROM node:22 AS build

WORKDIR /app
COPY . /app/

RUN npm install --legacy-peer-deps
RUN npm run build

# Stage 2: Serve app with nginx server
# Pinned to the same minor the deployment's reverse proxy uses. `nginx:alpine` floats, and a
# floating base image has already broken this product once (the Keycloak login theme).
FROM nginx:1.27-alpine

# envsubst is required by entrypoint.sh (not included in nginx:alpine by default)
RUN apk add --no-cache gettext

# Copy Angular build output
COPY --from=build /app/dist/ims-webapp/ /usr/share/nginx/html

# Copy the environment template and entrypoint script
COPY env.template.js /usr/share/nginx/html/assets/env.template.js
COPY entrypoint.sh /entrypoint.sh
# Strip CRLF if the repo was checked out on Windows — otherwise exec fails with
# "no such file or directory" (kernel looks for /bin/sh\r).
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

# Copy the nginx configuration file
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Set the entrypoint
ENTRYPOINT ["/entrypoint.sh"]

# Expose port 80
EXPOSE 80
