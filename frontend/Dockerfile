FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build the React app for production
RUN npm run build

# Use a lightweight node server to serve the static files
RUN npm install -g serve
EXPOSE 5173

CMD ["serve", "-s", "dist", "-l", "5173"]
