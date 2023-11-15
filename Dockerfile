FROM node:18.18.2
WORKDIR /app
COPY . .
RUN yarn install
RUN yarn build
EXPOSE 3000
CMD ["yarn","start"]