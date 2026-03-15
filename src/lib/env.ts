export function getClientEnv(name: 'VITE_CONVEX_URL' | 'VITE_CONVEX_SITE_URL') {
  const value = import.meta.env[name];

  if (!value) {
    throw new Error(
      `Missing ${name}. Add it to your environment before starting the app.`
    );
  }

  return value;
}
