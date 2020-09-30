# Dockerfile for React client
# https://medium.com/mozilla-club-bbsr/dockerizing-a-mern-stack-web-application-ebf78babf136
# Build react client
FROM node:10.16-alpine

# Working directory
# TODO:
WORKDIR /usr/src/app

COPY package*.json ./

###  Installing dependencies
RUN npm install --silent

# copy local files to app folder
COPY . .

EXPOSE 1234

# TODO
CMD ["npm","start"] 