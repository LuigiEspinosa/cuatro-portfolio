/* `demo:reset` for the tracker (AD-13, Story 5.9, ops/demo-principal.md § The reset). From the host, in a
 * one-shot container from the serving image, never inside the serving container:
 *
 *   docker compose --env-file .env.production --profile tracker run --rm --no-deps tracker \
 *     node node_modules/tsx/dist/cli.mjs scripts/demo-reset.ts
 */
import { main } from '@/lib/demo-reset'

main().then((code) => {
  process.exitCode = code
})
