"""
Unit tests for JLC2KiCadLib/symbol/symbol_handlers.py's h_P pin handler.

Regression coverage for https://github.com/TousstNicolas/JLC2KiCad_lib/issues/98:
on some EasyEDA symbols (e.g. connectors), the "pin number" field is a
duplicate of the pin name, while the rendered number is stored separately.
"""

from JLC2KiCadLib.symbol.symbol_handlers import h_P


class FakeKicadSymbol:
    drawing = ""
    pinNamesHide = "(pin_names hide)"
    pinNumbersHide = "(pin_numbers hide)"


# Real "P" line data for a HR911130A (C54408) MDI0+ pin, split on "~" with
# the leading "P" element removed. data[2] ("MDI0+") duplicates the pin
# name instead of holding a real number ; data[21] ("P2") is the pin number
# actually rendered on the schematic.
CONNECTOR_PIN_DATA = [
    "show",
    "0",
    "MDI0+",
    "280",
    "355",
    "180",
    "gge123",
    "0^^280",
    "355^^M 280 355 h 30",
    "#880000^^1",
    "306",
    "349",
    "0",
    "MDI0+",
    "start",
    "",
    "",
    "#0000FF^^1",
    "294",
    "354",
    "0",
    "P2",
    "end",
    "",
    "",
    "#0000FF^^0",
    "307",
    "355^^0",
    "M 310 358 L 313 355 L 310 352",
]

# Real "P" line data for a STM32F103C8T6 (C8734) VBAT pin, where data[2]
# and data[21] both hold the actual pin number "1".
IC_PIN_DATA = [
    "show",
    "0",
    "1",
    "315",
    "185",
    "180",
    "gge41",
    "0^^315",
    "185^^M315,185h10",
    "#880000^^1",
    "328.7",
    "189",
    "0",
    "VBAT",
    "start",
    "",
    "",
    "#0000FF^^1",
    "324.5",
    "184",
    "0",
    "1",
    "end",
    "",
    "",
    "#0000FF^^0",
    "322",
    "185^^0",
    "M 325 188 L 328 185 L 325 182",
]


def test_connector_pin_uses_rendered_number_instead_of_duplicated_name():
    kicad_symbol = FakeKicadSymbol()

    h_P(CONNECTOR_PIN_DATA, translation=(0, 0), kicad_symbol=kicad_symbol)

    assert 'name "MDI0+"' in kicad_symbol.drawing
    assert 'number "P2"' in kicad_symbol.drawing
    assert 'number "MDI0+"' not in kicad_symbol.drawing


def test_ic_pin_number_and_name_are_unaffected():
    kicad_symbol = FakeKicadSymbol()

    h_P(IC_PIN_DATA, translation=(0, 0), kicad_symbol=kicad_symbol)

    assert 'name "VBAT"' in kicad_symbol.drawing
    assert 'number "1"' in kicad_symbol.drawing


def test_falls_back_to_data_2_when_rendered_number_is_missing():
    data = list(IC_PIN_DATA)
    data[21] = ""  # no rendered number available

    kicad_symbol = FakeKicadSymbol()
    h_P(data, translation=(0, 0), kicad_symbol=kicad_symbol)

    assert 'number "1"' in kicad_symbol.drawing
