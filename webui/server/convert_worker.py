#!/usr/bin/env python3
"""
JLC2KiCad conversion worker.
Reads JSON config from stdin, runs conversion, streams log lines to stdout.
Exit code 0 = success, 1 = error.
"""
import sys
import json
import logging
import os
import types

config = json.loads(sys.stdin.read())

part_numbers = config["partNumbers"]
output_dir   = config["outputDir"]
options      = config.get("options", {})

# Build args namespace
args = types.SimpleNamespace(
    output_dir        = output_dir,
    footprint_creation= options.get("footprint", True),
    symbol_creation   = options.get("symbol", True),
    symbol_lib        = options.get("symbolLib", "jlc_lib"),
    symbol_lib_dir    = options.get("symbolLibDir", "symbol"),
    footprint_lib     = options.get("footprintLib", "footprint"),
    models            = options.get("models", "STEP"),   # "STEP", "WRL", ["STEP","WRL"], or []
    model_dir         = options.get("modelDir", "packages3d"),
    skip_existing     = options.get("skipExisting", False),
    model_base_variable = options.get("modelBaseVariable", ""),
)

# Streaming log handler
class StreamHandler(logging.Handler):
    def emit(self, record):
        msg = self.format(record)
        print(json.dumps({"type": "log", "level": record.levelname, "message": msg}), flush=True)

root = logging.getLogger()
root.setLevel(logging.INFO)
for h in root.handlers[:]:
    root.removeHandler(h)
sh = StreamHandler()
sh.setFormatter(logging.Formatter("%(levelname)s - %(message)s"))
root.addHandler(sh)

from JLC2KiCadLib.JLC2KiCadLib import add_component

errors = []
for part in part_numbers:
    print(json.dumps({"type": "progress", "part": part, "state": "start"}), flush=True)
    try:
        add_component(part, args)
        print(json.dumps({"type": "progress", "part": part, "state": "done"}), flush=True)
    except Exception as e:
        msg = str(e)
        errors.append({"part": part, "error": msg})
        print(json.dumps({"type": "progress", "part": part, "state": "error", "error": msg}), flush=True)

if errors:
    print(json.dumps({"type": "result", "success": False, "errors": errors}), flush=True)
    sys.exit(1)
else:
    print(json.dumps({"type": "result", "success": True}), flush=True)
    sys.exit(0)
