# Build react client
FROM node:20-bookworm-slim
WORKDIR /app

COPY package*.json ./
###  Installing dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      python3 \
      make \
      g++ \
    && rm -rf /var/lib/apt/lists/* \
    && npm ci --include=optional

COPY . .

# create dist files 
RUN npm run build

# nginx
FROM nginx:stable-alpine
COPY --from=0 /app/dist /usr/share/nginx/html

RUN rm /etc/nginx/conf.d/default.conf
COPY nginx/nginx.conf /etc/nginx/conf.d

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]