using LanguageServer, LanguageServer.SymbolServer

function main(args)
    if length(args) != 4
        error("Invalid number of arguments passed to julia language server.")
    end

    conn = stdout
    (outRead, outWrite) = redirect_stdout()

    if args[2] == "--debug=yes"
        ENV["JULIA_DEBUG"] = "all"
    elseif args[2] != "--debug=no"
        error("Invalid argument passed.")
    end

    symserver_store_path = joinpath(ARGS[4], "symbolstorev2")

    if !ispath(symserver_store_path)
        mkpath(symserver_store_path)
    end

    server = LanguageServerInstance(
        stdin,
        conn,
        args[1],
        args[3],
        nothing,
        symserver_store_path
    )

    run(server)
end

if abspath(PROGRAM_FILE) == @__FILE__
    main(ARGS)
end
