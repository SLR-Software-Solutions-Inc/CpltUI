// Real ACP client for CpltUI.
//
// Spawns `copilot --acp --no-auto-update` and speaks ACP JSON-RPC over its
// stdio via @zed-industries/agent-client-protocol's ClientSideConnection.
//
// Surface mirrors what the contract demands; index.ts owns dispatch.

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { Readable, Writable } from 'node:stream';
import {
  ClientSideConnection,
  ndJsonStream,
  type Client,
  type Agent,
  type InitializeResponse,
  type NewSessionRequest,
  type NewSessionResponse,
  type PromptRequest,
  type PromptResponse,
  type RequestPermissionRequest,
  type RequestPermissionResponse,
  type SessionNotification,
  type ReadTextFileRequest,
  type ReadTextFileResponse,
  type WriteTextFileRequest,
  type WriteTextFileResponse,
} from '@zed-industries/agent-client-protocol';

export interface AcpHandlers {
  onSessionUpdate: (n: SessionNotification) => Promise<void> | void;
  onPermissionRequest: (
    req: RequestPermissionRequest,
  ) => Promise<RequestPermissionResponse>;
  onReadTextFile?: (req: ReadTextFileRequest) => Promise<ReadTextFileResponse>;
  onWriteTextFile?: (
    req: WriteTextFileRequest,
  ) => Promise<WriteTextFileResponse>;
  onStderrLine?: (line: string) => void;
  onExit?: (code: number | null, signal: NodeJS.Signals | null) => void;
}

export interface AcpClientOptions {
  copilotBin?: string;
  cwd?: string;
  extraEnv?: Record<string, string>;
}

/**
 * Wraps the Copilot ACP server process + ClientSideConnection.
 */
export class AcpClient {
  private child: ChildProcessWithoutNullStreams;
  private conn: ClientSideConnection;
  private agent!: Agent;
  private disposed = false;

  constructor(handlers: AcpHandlers, opts: AcpClientOptions = {}) {
    const bin = opts.copilotBin ?? process.env.CPLTUI_COPILOT_BIN ?? 'copilot';
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      COPILOT_AUTO_UPDATE: 'false',
      NO_COLOR: '1',
      TERM: 'dumb',
      ...(opts.extraEnv ?? {}),
    };

    this.child = spawn(bin, ['--acp', '--no-auto-update'], {
      cwd: opts.cwd ?? process.cwd(),
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.child.on('error', (err) => {
      handlers.onStderrLine?.(`[spawn-error] ${err.message}`);
    });
    this.child.on('exit', (code, signal) => {
      handlers.onExit?.(code, signal);
    });

    if (handlers.onStderrLine) {
      this.child.stderr.setEncoding('utf8');
      let buf = '';
      this.child.stderr.on('data', (chunk: string) => {
        buf += chunk;
        let idx: number;
        while ((idx = buf.indexOf('\n')) !== -1) {
          const line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (line.trim()) handlers.onStderrLine!(line);
        }
      });
    }

    // ndJsonStream wants web-streams (WritableStream<Uint8Array> /
    // ReadableStream<Uint8Array>). Node streams convert via the
    // native `Writable.toWeb` / `Readable.toWeb` helpers.
    const output = Writable.toWeb(this.child.stdin) as WritableStream<Uint8Array>;
    const input = Readable.toWeb(this.child.stdout) as ReadableStream<Uint8Array>;
    const stream = ndJsonStream(output, input);

    const client: Client = {
      requestPermission: (p) => handlers.onPermissionRequest(p),
      sessionUpdate: async (p) => {
        await handlers.onSessionUpdate(p);
      },
      readTextFile: handlers.onReadTextFile,
      writeTextFile: handlers.onWriteTextFile,
    };

    this.conn = new ClientSideConnection((_agent) => {
      // toClient receives the agent proxy on construction.
      this.agent = _agent;
      return client;
    }, stream);
  }

  initialize(): Promise<InitializeResponse> {
    return this.conn.initialize({
      protocolVersion: 1,
      clientCapabilities: {
        fs: { readTextFile: true, writeTextFile: true },
      },
    });
  }

  newSession(params: NewSessionRequest): Promise<NewSessionResponse> {
    return this.conn.newSession(params);
  }

  prompt(params: PromptRequest): Promise<PromptResponse> {
    return this.conn.prompt(params);
  }

  cancel(sessionId: string): Promise<void> {
    return this.conn.cancel({ sessionId });
  }

  /** Resume a session previously persisted by Copilot (ACP session/load). */
  loadSession(params: { sessionId: string; cwd: string; mcpServers?: unknown[] }): Promise<unknown> {
    // @zed-industries/agent-client-protocol exposes loadSession on ClientSideConnection
    return (this.conn as unknown as { loadSession: (p: unknown) => Promise<unknown> }).loadSession({
      sessionId: params.sessionId,
      cwd: params.cwd,
      mcpServers: params.mcpServers ?? [],
    });
  }

  async authenticate(methodId: string): Promise<void> {
    await this.conn.authenticate({ methodId });
  }

  /** Best-effort `/model X` slash command via session/prompt as a stop-gap. */
  async setModelViaSlash(sessionId: string, model: string): Promise<void> {
    // FIXME: ACP exposes setSessionModel as UNSTABLE — prefer that once Copilot
    // advertises support. For v1, inject a `/model` slash command via prompt so
    // the existing command pipeline picks it up.
    await this.conn.prompt({
      sessionId,
      prompt: [{ type: 'text', text: `/model ${model}` }],
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    try {
      this.child.stdin.end();
    } catch {
      /* ignore */
    }
    if (!this.child.killed) {
      try {
        this.child.kill('SIGTERM');
      } catch {
        /* ignore */
      }
    }
  }
}
