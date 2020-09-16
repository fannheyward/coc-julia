# coc-julia

Julia extension for coc.nvim

**Notes**:

There is something broken with [LanguageServer.jl](https://github.com/julia-vscode/LanguageServer.jl) v3.2. The fix [#821](https://github.com/julia-vscode/LanguageServer.jl/pull/821) has been merged but not released yet. You need to install the latest LanguageServer.jl from GitHub.

```
using Pkg
] // enter Pkg REPL
add https://github.com/julia-vscode/LanguageServer.jl
```

## Install

`:CocInstall coc-julia`

## License

MIT

---

> This extension is created by [create-coc-extension](https://github.com/fannheyward/create-coc-extension)
