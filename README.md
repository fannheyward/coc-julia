# coc-julia

<!-- markdownlint-disable no-inline-html -->
<a href="https://github.com/sponsors/fannheyward"><img src="https://user-images.githubusercontent.com/345274/133218454-014a4101-b36a-48c6-a1f6-342881974938.png" alt="GitHub Sponsors" /></a>
<a href="https://patreon.com/fannheyward"><img src="https://c5.patreon.com/external/logo/become_a_patron_button.png" alt="Patreon donate button" /></a>
<a href="https://paypal.me/fannheyward"><img src="https://user-images.githubusercontent.com/345274/104303610-41149f00-5505-11eb-88b2-5a95c53187b4.png" alt="PayPal donate button" /></a>

Julia extension for coc.nvim provides support the Julia Programming Language with [LanguageServer.jl](https://github.com/julia-vscode/LanguageServer.jl).

## Install

`:CocInstall coc-julia`

## Configurations

| Configuration          | Description                                                      | Default |
| ---------------------- | ---------------------------------------------------------------- | ------- |
| julia.enabled          | Enable coc-julia extension                                       | `true`  |
| julia.executablePath   | Points to the Julia executable.                                  | `''`    |
| julia.environmentPath  | Path to a julia environment.                                     | `null`  |
| julia.lint.run         | Run the linter on active files.                                  | `true`  |
| julia.lint.missingrefs | Report possibly missing references.                              | `true`  |
| julia.lint.call        | Check calls against existing methods. (experimental)             | `false` |
| julia.lint.constif     | Check for constant conditionals of if statements.                | `true`  |
| julia.lint.lazy        | Check for deterministic lazy boolean operators.                  | `true`  |
| julia.lint.typeparam   | Check for unused DataType parameters.                            | `true`  |
| julia.lint.modname     | Check for invalid submodule names.                               | `true`  |
| julia.lint.pirates     | Check for type piracy.                                           | `true`  |
| julia.trace.server     | Traces the communication between client and the language server. | `off`   |

## Commands

- `julia.CompileLanguageServerSysimg`: use PackageCompiler.jl to compile a sysimage of LanguageServer.jl.

## License

MIT

---

> This extension is built with [create-coc-extension](https://github.com/fannheyward/create-coc-extension)
