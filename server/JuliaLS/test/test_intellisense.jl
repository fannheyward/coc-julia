server = LanguageServerInstance(IOBuffer(), IOBuffer(), dirname(Pkg.Types.Context().env.project_file), first(Base.DEPOT_PATH))
server.runlinter = true
server.jr_endpoint = nothing

LanguageServer.initialize_request(init_request, server, nothing)

testtext = """
module testmodule
struct testtype
    a
    b::Float64
    c::Vector{Float64}
end
function testfunction(a, b::Float64, c::testtype)
    return c
end
end
testmodule
f(a,b,c) = 1
f()
f(1,)
f(1,2,)
"""
LanguageServer.textDocument_didOpen_notification(LanguageServer.DidOpenTextDocumentParams(LanguageServer.TextDocumentItem("testdoc", "julia", 0, testtext)), server, nothing)

doc = LanguageServer.getdocument(server, LanguageServer.URI2("testdoc"))
LanguageServer.parse_all(doc, server)


res = LanguageServer.textDocument_hover_request(LanguageServer.TextDocumentPositionParams(LanguageServer.TextDocumentIdentifier("testdoc"), LanguageServer.Position(3, 11)), server, nothing)
@test res.contents.value == string(LanguageServer.sanitize_docstring(StaticLint.CoreTypes.Float64.doc), "\n```julia\nCore.Float64 <: Core.AbstractFloat\n```")

res = LanguageServer.textDocument_hover_request(LanguageServer.TextDocumentPositionParams(LanguageServer.TextDocumentIdentifier("testdoc"), LanguageServer.Position(7, 12)), server, nothing)
@test occursin(r"c::testtype", res.contents.value)

res = LanguageServer.textDocument_hover_request(LanguageServer.TextDocumentPositionParams(LanguageServer.TextDocumentIdentifier("testdoc"), LanguageServer.Position(9, 1)), server, nothing)
@test res.contents.value == "Closes module definition for `testmodule`\n"

res = LanguageServer.textDocument_signatureHelp_request(LanguageServer.TextDocumentPositionParams(LanguageServer.TextDocumentIdentifier("testdoc"), LanguageServer.Position(12, 2)), server, nothing)
@test res.activeParameter == 0

res = LanguageServer.textDocument_signatureHelp_request(LanguageServer.TextDocumentPositionParams(LanguageServer.TextDocumentIdentifier("testdoc"), LanguageServer.Position(13, 4)), server, nothing)
@test res.activeParameter == 1

res = LanguageServer.textDocument_signatureHelp_request(LanguageServer.TextDocumentPositionParams(LanguageServer.TextDocumentIdentifier("testdoc"), LanguageServer.Position(14, 6)), server, nothing)
@test res.activeParameter == 2