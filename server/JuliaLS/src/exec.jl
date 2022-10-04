using Pkg
using LanguageServer
using LanguageServer.JuliaFormatter

Pkg.test("LanguageServer")
JuliaFormatter.format(@__FILE__)
