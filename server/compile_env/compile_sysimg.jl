using PackageCompiler
import Pkg, Libdl
import LanguageServer

env_path = ARGS[1]
img_path = ARGS[2]

project_file = joinpath(env_path, "Project.toml")
sysimg_file  = joinpath(img_path, "sysimg.$(Libdl.Libdl.dlext)")
exec_file    = joinpath(joinpath(dirname(pathof(LanguageServer)), "../test/runtests.jl"))

project  = Pkg.API.read_project(project_file)
packages = Symbol.(collect(keys(project.deps)))

@info "Building a sysimage for the environment '$env_path' to '$img_path'."

create_sysimage(packages; sysimage_path=sysimg_file, project=env_path)
