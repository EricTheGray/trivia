"""Minimal .xlsx reading, standard library only — no openpyxl, no pandas.

Handles both string storage modes: a shared-strings table, and inline strings
(which the workbook switched to, and which has no sharedStrings.xml at all).
"""

import re
import zipfile
import xml.etree.ElementTree as ET

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
RID = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"


def _shared_strings(zf):
    if "xl/sharedStrings.xml" not in zf.namelist():
        return []
    return [
        "".join(t.text or "" for t in si.iter(NS + "t"))
        for si in ET.fromstring(zf.read("xl/sharedStrings.xml"))
    ]


def _sheet_path(zf, name):
    rels = {
        r.get("Id"): r.get("Target")
        for r in ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
    }
    for sheet in ET.fromstring(zf.read("xl/workbook.xml")).find(NS + "sheets"):
        if sheet.get("name") == name:
            target = rels[sheet.get(RID)].lstrip("/")
            return target if target.startswith("xl/") else "xl/" + target
    raise SystemExit(f'no "{name}" sheet in this workbook')


def read_rows(path, sheet_name):
    """Every non-empty row of a sheet, as dicts keyed by the header row."""
    with zipfile.ZipFile(path) as zf:
        shared = _shared_strings(zf)
        root = ET.fromstring(zf.read(_sheet_path(zf, sheet_name)))

    raw = []
    for row in root.iter(NS + "row"):
        cells = {}
        for cell in row:
            column = re.match(r"[A-Z]+", cell.get("r")).group()
            kind, value = cell.get("t"), cell.find(NS + "v")
            if kind == "inlineStr":
                text = "".join(t.text or "" for t in cell.iter(NS + "t"))
            elif value is None:
                text = ""
            elif kind == "s":
                text = shared[int(value.text)]
            else:
                text = value.text
            cells[column] = (text or "").strip()
        if any(cells.values()):
            raw.append(cells)

    if not raw:
        raise SystemExit(f'"{sheet_name}" sheet is empty')

    header = raw[0]
    return [{name: row.get(letter, "") for letter, name in header.items()} for row in raw[1:]]


def require_columns(rows, sheet_name, *names):
    present = set(rows[0]) if rows else set()
    missing = [name for name in names if name not in present]
    if missing:
        raise SystemExit(f'{sheet_name} is missing column(s): {", ".join(missing)}')


def to_int(value, default=None):
    """Sheet numbers arrive as floats ("1984.0")."""
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default
