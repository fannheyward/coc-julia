module JuliaLS

using LanguageServer, LanguageServer.SymbolServer

function julia_main()::Cint
    server = LanguageServer.LanguageServerInstance(stdin, stdout)
    server.runlinter = true
    run(server)
    return 0
end

end # module
