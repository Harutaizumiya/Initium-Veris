# Initium Veris Mobile

Expo + React Native + TypeScript mobile app for the existing monorepo.

## Development

```bash
pnpm --filter mobile dev
```

Set the API base URL with `EXPO_PUBLIC_API_BASE_URL` when the Django API is not reachable at the default local URL:

```bash
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api pnpm --filter mobile dev
```

On a physical device, use the LAN IP of the machine running Django, for example `http://192.168.1.10:8000/api`.
