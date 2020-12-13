import { exec } from 'child_process';
import {
  CompletionContext,
  ExtensionContext,
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  services,
  workspace,
  WorkspaceConfiguration,
} from 'coc.nvim';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import { CompletionItem, CompletionList, NotificationType, Position, Range } from 'vscode-languageserver-protocol';
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
  private compileEnv: string;
  private sysimgDir: string;
  constructor(private readonly context: ExtensionContext) {
    this.config = new Config();
    this.lsProj = path.join(context.extensionPath, 'server', 'JuliaLS');
    this.mainJulia = path.join(context.extensionPath, 'server', 'JuliaLS/src/main.jl');
    this.compileEnv = path.join(context.extensionPath, 'server', 'compile_env');
    if (!fs.existsSync(context.storagePath)) {
      fs.mkdirSync(context.storagePath);
    }
    this.serverRoot = path.join(context.storagePath, 'JuliaLS');
    if (!fs.existsSync(this.serverRoot)) {
      fs.mkdirSync(this.serverRoot);
    }
    this.sysimgDir = path.join(context.storagePath, 'sysimg');
    if (!fs.existsSync(this.sysimgDir)) {
      fs.mkdirSync(this.sysimgDir);
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
    const cmd = `${bin} --project=@. --startup-file=no --history-file=no -e "using Pkg; println(dirname(Pkg.Types.Context().env.project_file))"`;
    return (await execPromise(cmd)).stdout.trim();
  }

  private async resolveSysimgPath() {
    let sysimg_name = 'sysimg.so';
    switch (process.platform) {
      case 'win32':
        sysimg_name = 'sysimg.dll';
        break;
      case 'darwin':
        sysimg_name = 'sysimg.dylib';
        break;
    }
    const sysimg = path.join(this.sysimgDir, sysimg_name);
    if (fs.existsSync(sysimg)) {
      return sysimg;
    }
    const bin = this.resolveJuliaBin()!;
    const cmd = `${bin} --project=${this.compileEnv} --startup-file=no --history-file=no -e "import PackageCompiler; println(PackageCompiler.default_sysimg_path())"`;
    return (await execPromise(cmd)).stdout.trim();
  }

  private async resolveExecFile() {
    const bin = this.resolveJuliaBin()!;
    const cmd = `${bin} --project=${this.lsProj} --startup-file=no --history-file=no -e "import LanguageServer; println(joinpath(dirname(pathof(LanguageServer)), \\"../test/runtests.jl\\"))"`;
    return (await execPromise(cmd)).stdout.trim();
  }

  async compileServerSysimg() {
    workspace.showMessage(`PackageCompiler.jl will take about 5 mins to compile...`);
    const bin = this.resolveJuliaBin()!;
    const execfile = await this.resolveExecFile();
    await workspace.createTerminal({ name: 'coc-julia-ls' }).then((t) => {
      const cmd = `${bin} --project=${this.compileEnv} ${path.join(this.compileEnv, 'compile.jl')} -s ${this.lsProj} ${this.sysimgDir} ${execfile}`;
      t.sendText(cmd);
    });
  }

  async compileServerBin() {
    workspace.showMessage(`PackageCompiler.jl will take about 10 mins to compile...`);
    const bin = this.resolveJuliaBin()!;
    const execfile = await this.resolveExecFile();
    await workspace.createTerminal({ name: 'coc-julia-ls' }).then((t) => {
      const cmd = `${bin} --project=${this.compileEnv} ${path.join(this.compileEnv, 'compile.jl')} -b ${this.lsProj} ${this.serverRoot} ${execfile}`;
      t.sendText(cmd);
    });
  }

  private async prepareJuliaArgs(): Promise<string[]> {
    await this.resolveMissingPkgs();
    const sysimg = await this.resolveSysimgPath();
    return ['--startup-file=no', '--history-file=no', `--sysimage=${sysimg}`, '--depwarn=no', `--project=${this.lsProj}`, this.mainJulia];
  }

  private async prepareLSArgs(): Promise<string[]> {
    await this.resolveMissingPkgs();
    const env = await this.resolveEnvPath();
    const depopPath = process.env.JULIA_DEPOT_PATH ? process.env.JULIA_DEPOT_PATH : '';
    return [env, '--debug=no', depopPath, this.context.storagePath];
  }

  async startServer() {
    let bin = path.join(this.serverRoot, 'bin', process.platform === 'win32' ? 'JuliaLS.exe' : 'JuliaLS');
    let args: string[] = await this.prepareLSArgs();
    if (!fs.existsSync(bin)) {
      bin = this.resolveJuliaBin()!;
      const juliaArgs = await this.prepareJuliaArgs();
      args = juliaArgs.concat(args);
    }

    const tmpdir = (await workspace.nvim.eval('$TMPDIR')) as string;
    const outputChannel = workspace.createOutputChannel('Julia Language Server Trace');
    const serverOptions: ServerOptions = {
      command: bin,
      args,
      options: { env: { ...process.env, TMPDIR: tmpdir } },
    };
    const clientOptions: LanguageClientOptions = {
      documentSelector: ['julia', 'juliamarkdown'],
      initializationOptions: workspace.getConfiguration('julia'),
      synchronize: {
        configurationSection: ['julia.lint', 'julia.format'],
        fileEvents: workspace.createFileSystemWatcher('**/*.{jl,jmd}'),
      },
      progressOnInitialization: true,
      outputChannel,
      middleware: {
        provideCompletionItem: async (document, position, context: CompletionContext, token, next) => {
          const option = context.option!;
          const input = option.input.startsWith(option.word) ? option.input : option.word + option.input;
          const res = (await next(document, position, context, token)) as CompletionList;
          const items: CompletionItem[] = [];
          if (res && Array.isArray(res.items)) {
            for (const item of res.items) {
              if (item.textEdit && item.kind !== 11) {
                const newText = item.textEdit.newText;
                if (!newText.startsWith(input)) {
                  const range = Object.assign({}, item.textEdit.range);
                  const start = Position.create(range.start.line, range.start.character - input.length);
                  const end = Position.create(range.end.line, range.end.character);
                  item.textEdit.newText = `${input}${newText}`;
                  item.textEdit.range = Range.create(start, end);
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
          textDocument: {
            uri: uri,
            languageId: 'julia',
            version: 1,
            text: doc.textDocument.getText(),
          },
        };
        client.sendNotification('julia/reloadText', params);
      });
    });
  }
}

/* vim: set ts=2 sw=2: */
