# kyros

## Environment variables

### `apps/api/.env`
```
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB_NAME?schema=public
RP_ID=localhost
RP_ORIGIN=http://localhost:3000
RP_NAME=Kairos Tax Vault
TRUELAYER_CLIENT_ID=
TRUELAYER_CLIENT_SECRET=
TRUELAYER_REDIRECT_URI=http://localhost:4000/truelayer/callback
NEXT_PUBLIC_BASE_URL=http://localhost:3000
PORT=4000
```

### `apps/web/.env`
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=replace-with-a-random-32-byte-base64
```