module JuliaLS

if VERSION < v"1.0.0"
    error("Julia language server only works with julia 1.0.0+")
end

include("main.jl")

function julia_main()::Cint
    try
        main(ARGS)
    catch
        Base.display_error(err, catch_backtrace())
        return 1
    end
    return 0
end

end # module
