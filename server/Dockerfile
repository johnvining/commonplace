#  Dockerfile for Node Express Backend
# https://medium.com/mozilla-club-bbsr/dockerizing-a-mern-stack-web-application-ebf78babf136


FROM node:19-alpine

# Create App Directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Install Dependencies
COPY package*.json ./

# --no-cache: download package index on-the-fly, no need to cleanup afterwards
# --virtual: bundle packages, remove whole bundle at once, when done
# https://github.com/nodejs/docker-node/issues/282
RUN apk --no-cache --virtual build-dependencies add \
    python3 \
    make \
    g++ \
    && npm install \
    && npm i openai\
    && npm i tesseract.js\
    && apk del build-dependencies

# Copy app source code
COPY . .

# Exports
EXPOSE 3000

CMD ["npm","run","restart"]
