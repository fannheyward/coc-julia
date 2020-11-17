#!/usr/bin/env bash

JULIABIN="julia"
JULIACOMP=$1
JULIAPROJ="JuliaLS"

HL='\033[1;4;31m'
NC='\033[0m'

errorexit() {
    echo -e ${HL}"$@"${NC}
    exit 1
}

echo -e ${HL}Compiling...${NC}

$JULIABIN --startup-file=no --history-file=no -e \
    "import Pkg;
    Pkg.activate(\"${JULIAPROJ}\");
    Pkg.add([\"PackageCompiler\", \"Test\", \"Sockets\", \"CSTParser\", \"StaticLint\", \"JSON\", \"JSONRPC\"]);
    using PackageCompiler;
    create_app(\"${JULIAPROJ}\", \"${JULIACOMP}\", force=true, precompile_execution_file=\"./JuliaLS/test/runtests.jl\");"

echo -e ${HL}Compiled${NC}
