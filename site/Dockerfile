# Dockerfile for React client
# https://medium.com/mozilla-club-bbsr/dockerizing-a-mern-stack-web-application-ebf78babf136
# Build react client
FROM node:10.16-alpine

# Working directory
# TODO:
WORKDIR /usr/src/app

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

# copy local files to app folder
COPY . .

EXPOSE 1234

# TODO
CMD ["npm","start"] 