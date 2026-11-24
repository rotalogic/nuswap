FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Ditanam ke halaman saat build, jadi harus diisi di sini, bukan saat start.
ARG NEXT_PUBLIC_SITE_URL
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start"]
