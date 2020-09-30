#  Dockerfile for Node Express Backend
# https://medium.com/mozilla-club-bbsr/dockerizing-a-mern-stack-web-application-ebf78babf136


FROM node:10.16-alpine

# Create App Directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Install Dependencies
COPY package*.json ./

RUN npm install --silent
# TODO: Production build

# Copy app source code
COPY . .

# Exports
EXPOSE 3000

CMD ["npm","run","restart"]
