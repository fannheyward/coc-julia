import { execSync } from 'child_process';
import { ExtensionContext, LanguageClient, LanguageClientOptions, ServerOptions, services, workspace, WorkspaceConfiguration } from 'coc.nvim';
import fs from 'fs';
import os from 'os';
import { NotificationType } from 'vscode-languageserver-protocol';
import which from 'which';

const JuliaFullTextNotification = new NotificationType<string, string>('julia/getFullText');

class Config {
  private cfg: WorkspaceConfiguration;

  constructor() {
    this.cfg = workspace.getConfiguration('julia');
  }

  get enabled() {
    return this.cfg.get('enabled') as boolean;
  }

  get executablePath() {
    return this.cfg.get('executablePath') as string;
  }

  get environmentPath() {
    return this.cfg.get('environmentPath') as string;
  }
}

export class Ctx {
  public readonly config: Config;
  constructor(private readonly context: ExtensionContext) {
    this.config = new Config();
  }

  resolveJuliaBin(): string | null {
    let bin = this.config.executablePath;
    if (bin.startsWith('~')) {
      bin = os.homedir() + bin.slice(1);
    }
    if (bin && fs.existsSync(bin)) {
      return bin;
    }

    const cmd = process.platform === 'win32' ? 'julia.exe' : 'julia';
    return which.sync(cmd, { nothrow: true });
  }

  async resolveMissingPkgs(): Promise<string[]> {
    const bin = this.resolveJuliaBin();
    const installed = execSync(`${bin!} -e "using Pkg; Pkg.status()"`)
      .toString()
      .split('\n');

    const missing: string[] = [];
    const pkgs = ['LanguageServer', 'StaticLint', 'SymbolServer'];
    for (const p of pkgs) {
      if (installed.some((s) => s.includes(p))) {
        continue;
      }
      missing.push(p);
    }

    return missing;
  }

  async resolveEnvPath() {
    if (this.config.environmentPath) {
      return this.config.environmentPath;
    }

    const bin = this.resolveJuliaBin();
    return execSync(`${bin!} --startup-file=no --history-file=no -e "using Pkg; println(dirname(Pkg.Types.Context().env.project_file))"`)
      .toString()
      .trim();
  }

  async startServer() {
    const env = await this.resolveEnvPath();
    const bin = this.resolveJuliaBin();
    const args = [
      '--startup-file=no',
      '--history-file=no',
      '--depwarn=no',
      '--eval',
      `using LanguageServer; import StaticLint; import SymbolServer; server = LanguageServer.LanguageServerInstance(stdin, stdout, ${env}, ""); server.runlinter = true; run(server);`,
    ];

    const outputChannel = workspace.createOutputChannel('Julia Language Server Trace');
    const serverOptions: ServerOptions = { command: bin!, args };
    const clientOptions: LanguageClientOptions = {
      documentSelector: ['julia', 'juliamarkdown'],
      initializationOptions: workspace.getConfiguration('julia'),
      synchronize: { configurationSection: ['julia.lint', 'julia.format'], fileEvents: workspace.createFileSystemWatcher('**/*.{jl,jmd}') },
      progressOnInitialization: true,
      outputChannel,
    };

    const client = new LanguageClient('julia', 'Julia Language Server', serverOptions, clientOptions);
    this.context.subscriptions.push(services.registLanguageClient(client));
    await client.onReady().then(() => {
      client.onNotification(JuliaFullTextNotification.method, (uri) => {
        const doc = workspace.getDocument(uri);
        const params = {
          textDocument: { uri: uri, languageId: 'julia', version: 1, text: doc.textDocument.getText() },
        };
        client.sendNotification('julia/reloadText', params);
      });
    });
  }
}
