import { ExtensionContext, workspace, WorkspaceConfiguration } from 'coc.nvim';
import fs from 'fs';

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
}

export class Ctx {
  public readonly config: Config;
  constructor(private readonly context: ExtensionContext) {
    this.config = new Config();
  }

  resolveBin() {
    let bin = this.config.executablePath;
    if (bin && fs.existsSync(bin)) {
      return bin;
    }

    const pathsToSearch: string[] = [];
    if (process.platform === 'win32') {
    }
  }
}
