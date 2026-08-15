FROM node:20

WORKDIR /app

# 安装依赖（含构建所需 devDependencies）
COPY package.json package-lock.json ./
RUN npm ci

# 拷贝源码并构建（前端 dist/public + 后端 dist/boot.js）
COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start"]
