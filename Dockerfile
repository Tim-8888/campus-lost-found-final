FROM node:24-alpine AS frontend-build
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
# Same origin in production: no browser requests to localhost and no second URL.
ENV VITE_API_BASE_URL=/api/v1
RUN npm run build

FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_ENV=production \
    PORT=8080
WORKDIR /app/backend
COPY backend/requirements.txt backend/requirements.deploy.txt ./
RUN pip install --no-cache-dir -r requirements.deploy.txt
COPY backend/ ./
COPY --from=frontend-build /build/frontend/dist /app/frontend/dist
RUN mkdir -p /app/backend/uploads
EXPOSE 8080
CMD ["python", "-m", "scripts.start_cloud"]
