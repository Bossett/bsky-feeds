FROM node:21.6.1
WORKDIR /app
COPY . .
RUN yarn install
RUN yarn build
EXPOSE 3000
CMD ["yarn","start"]