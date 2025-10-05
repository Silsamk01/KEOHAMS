// Clustered startup to utilize all CPU cores
const cluster = require('cluster');
const os = require('os');

if (cluster.isPrimary) {
  const cpuCount = Number(process.env.WEB_CONCURRENCY) || os.cpus().length;
  console.log(`Primary ${process.pid} starting ${cpuCount} workers`);
  for (let i = 0; i < cpuCount; i++) cluster.fork();

  cluster.on('exit', (worker, code, signal) => {
    console.warn(`Worker ${worker.process.pid} exited (${signal || code}). Spawning replacement...`);
    cluster.fork();
  });
} else {
  require('./server');
}
