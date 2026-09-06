# AGENTS.md

A durable AI agent built with Inngest + pi-ai. Think/act/observe loop with multi-channel messaging (Slack, Telegram). No framework — just TypeScript.

## Stack

- **Runtime**: Bun 1.2+ (native TypeScript execution, no build step)
- **Package manager**: Bun
- **LLM interface**: pi-ai (`@earendil-works/pi-ai`) — unified `Models.complete()` across Anthropic, OpenAI, Google
- **Durability**: Inngest — every LLM call and tool execution is a `step.run()`
- **Schemas**: TypeBox (via `typebox`, re-exported by pi-ai as `Type`) for tool parameter validation

## Commands

```bash
bun install           # Install dependencies
bun run dev           # Dev mode (local Inngest dev server, file watching)
bun start             # Production mode (connects to Inngest Cloud via WebSocket)
bun run typecheck     # Type check with tsc --noEmit
bun run webhooks      # List registered Inngest webhooks and their transforms
```

No test runner is configured. There is no build step — Bun runs TypeScript directly.

`bun install` reports blocked lifecycle scripts for `protobufjs` and `@google/genai`. Both are safe to
leave blocked: `protobufjs`'s postinstall only prints a version-scheme advisory, and `@google/genai`'s
preinstall is an explicit no-op. Do not add them to `trustedDependencies`.

## Architecture

**Event flow**: Channel webhook → Inngest event (`agent.message.received`) → agent loop → reply event (`agent.reply.ready`) → channel handler

**Key patterns**:

- The agent loop (`src/agent-loop.ts`) is a while loop where each iteration is an Inngest step
- Every Inngest function is in `src/functions/` — each file exports one function
- Channels implement the `ChannelHandler` interface (`src/channels/types.ts`) with `sendReply`, `acknowledge`, and optional `setup`
- Workspace files (`workspace/SOUL.md`, `USER.md`, `MEMORY.md`) are injected into the system prompt
- Tool definitions live in `src/lib/tools.ts` using TypeBox schemas
- `src/lib/models.ts` holds **one** pi-ai `Models` registry for the process (it is stateful — a second
  instance would not see providers registered on the first), and every LLM call goes through its
  `complete()` wrapper so the configured provider's API key beats any ambient `ANTHROPIC_AUTH_TOKEN`

**Adding a channel**: Create `src/channels/<name>/` with `handler.ts`, `api.ts`, `setup.ts`, `transform.ts`, `format.ts`, then register in `src/channels/index.ts`. No changes needed outside `src/channels/`.

## Conventions

- ESM only (`"type": "module"` in package.json), use `.ts` extensions in imports
- No build artifacts — `tsconfig.json` has `noEmit: true`
- Config is loaded from env vars via `src/config.ts`
- Workspace files in `workspace/` are agent-writable at runtime; source files in `src/` are not

## Agent skills

### Issue tracker

Issues and specs live as markdown files under `.scratch/<feature>/` in this repo. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles are used verbatim as label strings. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
