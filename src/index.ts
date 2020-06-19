import { ExtensionContext, workspace } from 'coc.nvim';
import { Ctx } from './ctx';

export async function activate(context: ExtensionContext): Promise<void> {
  const ctx = new Ctx(context);
  if (!ctx.config.enabled) return;

  const bin = ctx.resolveJuliaBin();
  if (!bin) {
    workspace.showMessage(`Can't find julia`, 'warning');
    return;
  }

  await ctx.startServer();
}
