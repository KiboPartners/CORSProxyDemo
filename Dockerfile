FROM node:12-alpine

WORKDIR /tmp
COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 80
CMD [ "node", "app.js" ]