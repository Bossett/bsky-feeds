FROM node:21
WORKDIR /app
COPY . .
RUN yarn install
EXPOSE 3000
CMD ["yarn","start"]