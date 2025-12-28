# Deployment Guide for Volatile Sagan

This guide describes how to deploy the Volatile Sagan application, which requires a specific environment for LaTeX generation.

## Prerequisites

- Docker installed on your machine or deployment server.
- Node.js (v20+) for local development.

## Building the Docker Image

The application uses a multi-stage Dockerfile that installs a lightweight TeX Live environment with LuaLaTeX and HaranoAji fonts (for Japanese support).

To build the image, run:

```bash
docker build -t math-app .
```

## Running the Container

Once built, you can run the container locally. The application listens on port 8080 by default inside the container.

```bash
# Map local port 3000 to container port 8080
docker run -p 3000:8080 math-app
```

Access the application at `http://localhost:3000`.

## Deployment to Cloud Providers

### General Docker Hosting (e.g., Cloud Run, App Runner, Render)

1.  **Build and Push**: Build the Docker image and push it to a container registry (e.g., Docker Hub, ECR, GCR).
2.  **Configure**: Set the target port to `8080` (or set the `PORT` env var).
3.  **Deploy**: Deploy the image. The container includes all necessary dependencies for PDF generation.

### Environment Variables

- `PORT`: Port to listen on (default: 8080).
- `NODE_ENV`: Should be set to `production` (handled by Dockerfile).

## Local Development vs. Production

- **Local (macOS)**: The app uses `lualatex` found in your system path (e.g., MacTeX). The code adds common paths like `/Library/TeX/texbin` automatically.
- **Production (Docker)**: The app uses `lualatex` from the installed `texlive` packages in the container (`/usr/bin/lualatex`).
