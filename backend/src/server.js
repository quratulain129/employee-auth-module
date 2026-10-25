import { createApp } from './app.js';
import { config } from './config/env.js';

createApp().listen(config.port, () => {
  const line = (label, ok) => `  ${label}: ${ok ? 'configured' : 'NOT configured (login button will show an error)'}`;
  console.log(`Auth backend running at ${config.backendUrl} (NODE_ENV=${config.env})`);
  console.log(line('Google', config.google.enabled));
  console.log(line('Microsoft', config.microsoft.enabled));
  console.log('Callback URLs to register with providers:');
  console.log(`  Google    : ${config.google.callbackUrl}`);
  console.log(`  Microsoft : ${config.microsoft.redirectUri}`);
  console.log(`  Allowed browser origins (CORS): ${config.corsOrigins.join(', ')}`);
  if (config.isProd) console.warn('WARNING: MemoryStore sessions are not suitable for production.');
});
