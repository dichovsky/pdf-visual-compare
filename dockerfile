FROM node:16.13.1-buster

# INSTALL PACKAGES
WORKDIR /usr/pkg/
COPY . .

RUN npm ci

# ON RUNNING THE IMAGE THIS COMMAND WILL BE TRIGGERED BY DEFAULT
CMD npm run docker:test
