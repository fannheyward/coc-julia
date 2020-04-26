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

  const missing = await ctx.resolveMissingPkgs();
  if (missing.length) {
    workspace.showMessage(`Julia module missing: ${missing.toString()}. You need to install them first.`, 'warning');
    return;
  }

  await ctx.startServer();
}
