FROM node:10.15.3
WORKDIR /app

# Good to have stuff
RUN npm install pm2 -g
RUN npm install babel-cli -g
RUN apt-get update
RUN apt-get install -y libav-tools

COPY package.json /app
RUN npm install
COPY . /app

ENV PATH="/app/node_modules/ffmpeg-static/bin/linux/x64:${PATH}"


# CMD node server.js
# OR
# Entrypoint script
RUN cp docker-entrypoint.sh /usr/local/bin/ && \
    chmod +x /usr/local/bin/docker-entrypoint.sh

# Expose the port
EXPOSE 8080
EXPOSE 9229


ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
