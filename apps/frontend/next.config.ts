import * as path from 'path';
import * as dotenv from 'dotenv';
import type { NextConfig } from 'next';

// Next only auto-loads .env files from this app's own directory, but the
// monorepo keeps shared settings in the root .env. Loading it here means
// KIOSK_HOST has a single definition shared with the backend.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Hosts allowed to load Next.js dev resources (client chunks and the HMR
 * websocket).
 *
 * Next 16 blocks cross-origin dev-resource requests by default. Because the
 * kiosk is reached as `localhost:3000` on this machine but over the network on
 * a customer's phone, the phone's origin looked cross-origin to the dev server.
 * That silently broke hydration on every client page: the server-rendered HTML
 * arrived, but no `useEffect` ever ran, so the UI stayed frozen on its loading
 * state and never called the API. That is why the tracking page showed
 * "Loading order..." forever and the drink detail page showed "Loading...".
 *
 * A name is used rather than a raw IP address, because DHCP can change this
 * machine's address at any time.
 */
const KIOSK_HOST = process.env.KIOSK_HOST ?? 'bimsaras-macbook-air.local';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: [KIOSK_HOST, 'localhost', '127.0.0.1'],
};

export default nextConfig;