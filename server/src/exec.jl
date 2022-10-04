using Pkg
using LanguageServer
using LanguageServer.JuliaFormatter

try
  Pkg.test("LanguageServer")
catch
end

JuliaFormatter.format(@__FILE__)
