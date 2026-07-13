# Use the official lightweight Node.js image
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package files first to leverage Docker caching
COPY package*.json ./

# Install dependencies (including devDependencies for building)
RUN npm ci

# Copy the rest of the application files
COPY . .

# Build the client application and compile the server.ts backend
RUN npm run build

# Expose port 7860 (Hugging Face default)
EXPOSE 7860

# Set environment variable for production and port
ENV NODE_ENV=production
ENV PORT=7860

# Start the application server
CMD ["npm", "start"]
