// pm2 process config - runs BOTH the Next.js web server and the background
// worker on the EC2 box, and keeps them alive (restart on crash + on reboot).
//
// On the server, from the app directory:
//   npm ci            # installs deps (incl. tsx, needed by the worker)
//   npm run build
//   pm2 start ecosystem.config.js
//   pm2 save && pm2 startup   # follow the printed command so it survives reboot
//
// Both processes read secrets from .env.local (see .env.example).
module.exports = {
  apps: [
    {
      name: "reelpouches-web",
      script: "npm",
      args: "start", // = next start (listens on PORT)
      env: { NODE_ENV: "production", PORT: "3000" },
      autorestart: true,
      max_restarts: 10,
    },
    {
      name: "reelpouches-worker",
      script: "npm",
      args: "run worker", // = node --env-file=.env.local --import tsx src/worker
      env: { NODE_ENV: "production" },
      autorestart: true,
      max_restarts: 10,
    },
  ],
};
