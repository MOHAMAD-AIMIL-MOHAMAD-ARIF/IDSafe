# IDSafe

This repository contains the Node.js/Express scaffolding for the IDSafe project. It includes TypeScript tooling, security middleware, and starter configuration for WebAuthn and PostgreSQL connectivity.

## Getting started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` file based on `.env.example` and fill in values for your environment (database URL, session secret, relying party ID/origin, and optional TLS paths).
3. Run the development server:
   ```bash
   npm run dev
   ```

## Available scripts

- `npm run dev` – start the server with `ts-node-dev` for live reload during development.
- `npm run build` – compile TypeScript to the `dist` directory.
- `npm run start` – run the compiled server from `dist`.
- `npm run lint` – lint the project with ESLint and Prettier.
- `npm run format` – format the project with Prettier.

## Environment variables

See `.env.example` for the full list of supported variables, including:

- `PORT`, `NODE_ENV`, `SESSION_SECRET`
- `DATABASE_URL`, `DB_SSL`, `DB_SSL_REJECT_UNAUTHORIZED`, `TLS_CA_PATH`
- `RP_ID`, `RP_ORIGIN`
- `TLS_KEY_PATH`, `TLS_CERT_PATH`

TLS variables allow the server to start in HTTPS mode when certificate paths are provided.
