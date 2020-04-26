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

  resolveBin(): string | null {
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

  async resolveEnvPath() {
    if (this.config.environmentPath) {
      return this.config.environmentPath;
    }

    const bin = this.resolveBin();
    return execSync(`${bin!} --startup-file=no --history-file=no -e "using Pkg; println(dirname(Pkg.Types.Context().env.project_file))"`)
      .toString()
      .trim();
  }

  async startServer() {
    // const env = await this.resolveEnvPath();
    const bin = this.resolveBin();
    const args = [
      '--startup-file=no',
      '--history-file=no',
      '--depwarn=no',
      '--eval',
      `using LanguageServer; import StaticLint; import SymbolServer; server = LanguageServer.LanguageServerInstance(stdin, stdout, false); server.runlinter = true; run(server);`,
    ];

    const sections = [
      'julia.format.indent',
      'julia.format.indents',
      'julia.format.ops',
      'julia.format.tuples',
      'julia.format.curly',
      'julia.format.calls',
      'julia.format.iterOps',
      'julia.format.comments',
      'julia.format.docs',
      'julia.format.lineends',
      'julia.format.kw',
      'julia.lint.run',
      'julia.lint.call',
      'julia.lint.iter',
      'julia.lint.nothingcomp',
      'julia.lint.constif',
      'julia.lint.lazy',
      'julia.lint.datadecl',
      'julia.lint.typeparam',
      'julia.lint.modname',
      'julia.lint.pirates',
      'julia.lint.missingrefs',
    ];
    const outputChannel = workspace.createOutputChannel('Julia Language Server Trace');
    const serverOptions: ServerOptions = { command: bin!, args };
    const clientOptions: LanguageClientOptions = {
      documentSelector: ['julia', 'juliamarkdown'],
      initializationOptions: workspace.getConfiguration('julia'),
      synchronize: { configurationSection: sections, fileEvents: workspace.createFileSystemWatcher('**/*.{jl,jmd}') },
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
