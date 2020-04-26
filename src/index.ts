import { commands, CompleteResult, ExtensionContext, listManager, sources, workspace } from 'coc.nvim';
import DemoList from './lists';
import { Ctx } from './ctx';

export async function activate(context: ExtensionContext): Promise<void> {
  const ctx = new Ctx(context);
  if (!ctx.config.enabled) return;

  const bin = ctx.resolveBin();
  if (!bin) {
    workspace.showMessage(`Can't find julia`, 'warning');
    return;
  }

  try {
    await ctx.startServer();
  } catch (e) {
    console.error('Julia LS start error:', e.message);
    return;
  }

  context.subscriptions.push(
    commands.registerCommand('coc-julia.Command', async () => {
      workspace.showMessage(`coc-julia Commands works!`);
    }),

    listManager.registerList(new DemoList(workspace.nvim)),

    sources.createSource({
      name: 'coc-julia completion source', // unique id
      shortcut: '[CS]', // [CS] is custom source
      priority: 1,
      triggerPatterns: [], // RegExp pattern
      doComplete: async () => {
        const items = await getCompletionItems();
        return items;
      },
    }),

    workspace.registerKeymap(
      ['n'],
      'coc-julia-keymap',
      async () => {
        workspace.showMessage(`registerKeymap`);
      },
      { sync: false }
    ),

    workspace.registerAutocmd({
      event: 'InsertLeave',
      request: true,
      callback: () => {
        workspace.showMessage(`registerAutocmd on InsertLeave`);
      },
    })
  );
}

async function getCompletionItems(): Promise<CompleteResult> {
  return {
    items: [
      {
        word: 'TestCompletionItem 1',
      },
      {
        word: 'TestCompletionItem 2',
      },
    ],
  };
}
