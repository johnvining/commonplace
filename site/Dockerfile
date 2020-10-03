# Build react client
FROM node:10.16-alpine
WORKDIR /app

COPY package*.json ./
###  Installing dependencies
# --no-cache: download package index on-the-fly, no need to cleanup afterwards
# --virtual: bundle packages, remove whole bundle at once, when done
# https://github.com/nodejs/docker-node/issues/282
RUN apk --no-cache --virtual build-dependencies add \
    python \
    make \
    g++ \
    && npm install \
    && apk del build-dependencies

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