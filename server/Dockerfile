# 第一階段：安裝正式環境的相依套件
FROM node:22-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# 第二階段：執行用的映像。基底映像內建的 npm、yarn 只在安裝時用得到，執行時不需要；
# 它們自帶一堆舊版套件（tar、minimatch…），會被弱點掃描一直抓到，所以直接移除。
FROM node:22-alpine

RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json personas.js index.js ./

ENV PORT=8787
EXPOSE 8787

# 不用 root 執行
USER node

CMD ["node", "index.js"]
