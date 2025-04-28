# Use Node.js 16 base image
FROM node:16

# Install Python 2 and git
RUN apt-get update && apt-get install -y python2 git build-essential

# Set python2 as default python for node-gyp
RUN ln -sf /usr/bin/python2 /usr/bin/python

# Set working directory
WORKDIR /usr/src/app

# Clone the loop-drop-app repo
RUN git clone https://github.com/mmckegg/loop-drop-app.git .

# Copy /lib folder into /node_modules as fallback
RUN mkdir -p node_modules && cp -r lib node_modules/

# Install dependencies
RUN npm install

# Expose any ports if needed (none specified in repo)

# Start the app
CMD ["npm", "start"]
