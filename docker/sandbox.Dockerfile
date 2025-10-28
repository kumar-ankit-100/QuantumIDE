# Use Node.js 20 as the base image
FROM node:20

# Set working directory
WORKDIR /app

# Install Vite globally
RUN echo "Installing create-vite globally..." && \
    npm install -g create-vite && \
    echo "create-vite installed"

# Create a Vite React project non-interactively
RUN echo "Creating Vite React project..." && \
    npx create-vite@latest my-react-app --yes --template react && \
    echo "Vite project created"

# Set working directory to the created project
WORKDIR /app/my-react-app

# Install project dependencies
RUN echo "Installing dependencies..." && \
    npm install && \
    echo "Dependencies installed"

# Copy project files to a persistent directory for access
# RUN echo "Copying project files..." && \
#     mkdir -p /app/project-files && \
#     cp -r /app/my-react-app/* /app/project-files/ && \
#     echo "


copied"

# Command to keep container running for exec commands
CMD ["tail", "-f", "/dev/null"]