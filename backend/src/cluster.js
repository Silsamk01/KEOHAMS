// Clustered startup to utilize all CPU cores
const cluster = require('cluster');
const os = require('os');

if (cluster.isPrimary) {
  const cpuCount = Number(process.env.WEB_CONCURRENCY) || os.cpus().length;
  console.log(`Primary ${process.pid} starting ${cpuCount} workers`);
  for (let i = 0; i < cpuCount; i++) cluster.fork();

  cluster.on('exit', (worker, code, signal) => {
    if (worker.exitedAfterDisconnect) {
      console.log(`Worker ${worker.process.pid} exited gracefully.`);
    } else {
      console.warn(`Worker ${worker.process.pid} exited unexpectedly (${signal || code}). Spawning replacement...`);
      cluster.fork();
    }
  });

  const shutdown = () => {
    console.log('Primary initiating graceful shutdown');
    const workers = Object.values(cluster.workers);
    workers.forEach(w => w && w.disconnect());
    setTimeout(()=> process.exit(0), 10000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
} else {
  require('./server');
}
