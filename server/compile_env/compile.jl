using PackageCompiler
import Pkg, Libdl

function compile_sysimg(args::Vector{<:AbstractString})
    args_len = length(args)
    args = abspath.(args)
    if args_len == 1
        env_path = img_path = args[1]
        exec_files = []
    elseif args_len >= 2
        env_path, img_path = args[1:2]
        exec_files = args[3:end]
    else
        error("at least one argument is required")
    end

    project_file = joinpath(env_path, "Project.toml")
    sysimg_file  = joinpath(img_path, "sysimg.$(Libdl.dlext)")

    project  = Pkg.API.read_project(project_file)
    packages = Symbol.(collect(keys(project.deps)))

    @info "Building a sysimage for the environment '$env_path' to '$img_path'."

    create_sysimage(packages; sysimage_path=sysimg_file, project=env_path,
        precompile_execution_file=exec_files)
end

function compile_app(args::Vector{<:AbstractString})
    args_len = length(args)
    args = abspath.(args)
    if args_len == 1
        pkg_dir = app_dir = args[1]
        exec_files = []
    elseif args_len >= 2
        pkg_dir,  app_dir = args[1:2]
        exec_files = args[3:end]
    else
        error("at least one argument is required when ")
    end

    @info "Building a binary app for package '$pkg_dir' to '$app_dir'."

    create_app(pkg_dir, app_dir; force=true,
        precompile_execution_file=exec_files)
end


function main(args::Vector{<:AbstractString})
    option = args[1]
    if option == "-s"
        compile_sysimg(args[2:end])
    elseif option == "-b"
        compile_app(args[2:end])
    else
        startswith(option, "-") && error("unknown compile option")
        compile_sysimg(args) # compile to a sysimage without a option
    end
end

if abspath(PROGRAM_FILE) == @__FILE__
    main(ARGS)
end
