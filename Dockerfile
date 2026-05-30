# Stage 1: Compile and Build Angular codebase
FROM node:18 AS build

WORKDIR /app
COPY . /app/

RUN npm install --legacy-peer-deps
RUN npm run build

# Stage 2: Serve app with nginx server
FROM nginx:alpine

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
