import { exec } from 'child_process';
import { ExtensionContext, LanguageClient, LanguageClientOptions, ServerOptions, services, workspace, WorkspaceConfiguration } from 'coc.nvim';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import { CompletionItem, CompletionList, InsertTextFormat, NotificationType } from 'vscode-languageserver-protocol';
import which from 'which';

const execPromise = promisify(exec);
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

interface Pkg {
  state: string;
  hash: string;
  name: string;
  version: string;
  repo: string;
}

export class Ctx {
  public readonly config: Config;
  private lsProj: string;
  private mainJulia: string;
  private serverRoot: string;
  constructor(private readonly context: ExtensionContext) {
    this.config = new Config();
    this.lsProj = path.join(context.extensionPath, 'server', 'languageserver');
    this.mainJulia = path.join(context.extensionPath, 'server', 'main.jl');
    this.serverRoot = context.storagePath;
    if (!fs.existsSync(this.serverRoot)) {
      fs.mkdirSync(this.serverRoot);
    }
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

  private formatPkg(vals: string[]): Pkg[] {
    const pkgs: Pkg[] = [];
    for (const val of vals) {
      const parts = val.split(' ');
      if (parts.length === 4 || parts.length === 5) {
        pkgs.push({
          state: parts[0],
          hash: parts[1],
          name: parts[2],
          version: parts[3],
          repo: parts[4] || '',
        });
      }
    }

    return pkgs;
  }

  private async resolveMissingPkgs(): Promise<void> {
    const bin = this.resolveJuliaBin()!;
    let cmd = `${bin} --project="${this.lsProj}" --startup-file=no --history-file=no -e "using Pkg; Pkg.status()"`;
    const pkgs = this.formatPkg((await execPromise(cmd)).stdout.split('\n'));
    if (pkgs.some((p) => p.state === '→')) {
      const ok = await workspace.showPrompt(`Some LanguageServer.jl deps are missing, would you like to install now?`);
      if (ok) {
        cmd = `${bin} --project="${this.lsProj}" --startup-file=no --history-file=no -e "using Pkg; Pkg.instantiate()"`;

        await workspace.createTerminal({ name: 'coc-julia-ls' }).then((t) => t.sendText(cmd));
      }
    }
  }

  private async resolveEnvPath() {
    if (this.config.environmentPath) {
      return this.config.environmentPath;
    }

    const bin = this.resolveJuliaBin()!;
    const cmd = `${bin} --project="." --startup-file=no --history-file=no -e "using Pkg; println(dirname(Pkg.Types.Context().env.project_file))"`;
    return (await execPromise(cmd)).stdout.trim();
  }

  async startServer() {
    await this.resolveMissingPkgs();
    const env = await this.resolveEnvPath();
    const bin = this.resolveJuliaBin()!;
    const depopPath = process.env.JULIA_DEPOT_PATH ? process.env.JULIA_DEPOT_PATH : '';
    const args = [
      '--startup-file=no',
      '--history-file=no',
      '--depwarn=no',
      `--project=${this.lsProj}`,
      this.mainJulia,
      env,
      '--debug=no',
      depopPath,
      this.serverRoot,
    ];

    const outputChannel = workspace.createOutputChannel('Julia Language Server Trace');
    const serverOptions: ServerOptions = { command: bin, args };
    const clientOptions: LanguageClientOptions = {
      documentSelector: ['julia', 'juliamarkdown'],
      initializationOptions: workspace.getConfiguration('julia'),
      synchronize: { configurationSection: ['julia.lint', 'julia.format'], fileEvents: workspace.createFileSystemWatcher('**/*.{jl,jmd}') },
      progressOnInitialization: true,
      outputChannel,
      middleware: {
        provideCompletionItem: async (document, position, context, token, next) => {
          const res = (await next(document, position, context, token)) as CompletionList;
          const items: CompletionItem[] = [];
          if (res && Array.isArray(res.items)) {
            for (const item of res.items) {
              const newText = item.textEdit?.newText;
              if (item.insertTextFormat === InsertTextFormat.Snippet) {
                if (newText && !newText.includes('$')) {
                  item.insertTextFormat = InsertTextFormat.PlainText;
                }
              }

              items.push(item);
            }
          }

          return { items, isIncomplete: res.isIncomplete };
        },
      },
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
