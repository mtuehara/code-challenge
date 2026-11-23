import { createApp } from './app';

async function main() {
  const app = await createApp();
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
  console.log(`Nest em execução. Healthcheck: http://localhost:${app.getHttpServer().address().port}/health`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
