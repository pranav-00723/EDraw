#!/usr/bin/env python3
"""
EDraw Stage 3 — General Deterministic Computational Geometry Solver (Python 3)

Reads a canonical v1.0.0 initial problem JSON from stdin, inspects its classified
Engineering Graphics module & entity schema, and solves all mathematically
determined quantities using exact Euclidean and trigonometric relationships.

Supported Active Modules:
- projection_of_points (single & multi-point 4-quadrant + boundaries + relative offsets)
- projection_of_straight_lines (arbitrary endpoints, partial solves, direction cosines, branches)

Registered Unsupported / Unclear Modules:
- Returns explicit solver_status ('unsupported' or 'needs_clarification') without guessing
  or forcing unrelated questions into straight-line geometry.
"""

from __future__ import annotations

import json
import math
import sys
from typing import Any, Dict, List, Optional, Tuple

TOL_MM = 1e-3
TOL_DEG = 1e-2
TOL_TRIG = 1e-5
ROUND_DIGITS = 4


def r4(val: float) -> float:
    cleaned = 0.0 if abs(val) < 1e-9 else val
    return round(cleaned, ROUND_DIGITS)


def deg2rad(deg: float) -> float:
    return math.radians(deg)


def rad2deg(rad: float) -> float:
    return math.degrees(rad)


def clamp_unit(val: float) -> float:
    if val > 1.0 and val <= 1.0 + TOL_TRIG:
        return 1.0
    if val < -1.0 and val >= -1.0 - TOL_TRIG:
        return -1.0
    return val


class GeometrySolverError(Exception):
    pass


def extract_initial_values(problem: Dict[str, Any]) -> Tuple[Dict[str, float], Dict[str, str], List[Dict[str, Any]]]:
    """Read strictly given numerical values (never treating null as zero)."""
    givens: Dict[str, float] = {}
    units: Dict[str, str] = {}
    issues: List[Dict[str, Any]] = []

    raw_givens = problem.get("givens", {})
    if not isinstance(raw_givens, dict):
        raise GeometrySolverError("Field 'givens' must be an object.")

    for prop, field in raw_givens.items():
        if not isinstance(field, dict):
            continue
        val = field.get("value")
        unit = field.get("unit", "mm")
        units[prop] = unit
        if val is None:
            continue
        if not isinstance(val, (int, float)) or not math.isfinite(val):
            issues.append(
                {
                    "code": "INVALID_NUMERIC_VALUE",
                    "stage": "stage_3_python_solver",
                    "severity": "error",
                    "field": prop,
                    "message": f"Given property '{prop}' has a non-finite numeric value.",
                }
            )
            continue
        givens[prop] = float(val)

    return givens, units, issues


def extract_constraint_flags(problem: Dict[str, Any]) -> Dict[str, bool]:
    flags = {
        "parallel_hp": False,
        "parallel_vp": False,
        "perpendicular_hp": False,
        "perpendicular_vp": False,
        "first_quadrant": False,
    }
    for c in problem.get("constraints", []) or []:
        if not isinstance(c, dict):
            continue
        kind = c.get("kind")
        if kind in flags:
            flags[kind] = True
        elif kind == "quadrant" and str(c.get("value", "")).lower() in ("first", "1", "first_quadrant"):
            flags["first_quadrant"] = True
    return flags


def classify_point_quadrant(y_mm: float, z_mm: float) -> Tuple[str, List[int], str, str]:
    on_hp = abs(z_mm) <= TOL_MM
    on_vp = abs(y_mm) <= TOL_MM

    if on_hp and on_vp:
        return "ON_BOTH_XY", [1, 2, 3, 4], "On XY line (0 mm)", "On XY line (0 mm)"
    if on_hp:
        if y_mm > 0:
            return "ON_HP_IN_FRONT", [1, 4], "On XY line (0 mm)", f"{r4(y_mm)} mm below XY"
        return "ON_HP_BEHIND", [2, 3], "On XY line (0 mm)", f"{r4(abs(y_mm))} mm above XY"
    if on_vp:
        if z_mm > 0:
            return "ON_VP_ABOVE", [1, 2], f"{r4(z_mm)} mm above XY", "On XY line (0 mm)"
        return "ON_VP_BELOW", [3, 4], f"{r4(abs(z_mm))} mm below XY", "On XY line (0 mm)"

    if z_mm > 0 and y_mm > 0:
        return "FIRST", [1], f"{r4(z_mm)} mm above XY", f"{r4(y_mm)} mm below XY"
    if z_mm > 0 and y_mm < 0:
        return "SECOND", [2], f"{r4(z_mm)} mm above XY", f"{r4(abs(y_mm))} mm above XY"
    if z_mm < 0 and y_mm < 0:
        return "THIRD", [3], f"{r4(abs(z_mm))} mm below XY", f"{r4(abs(y_mm))} mm above XY"
    return "FOURTH", [4], f"{r4(abs(z_mm))} mm below XY", f"{r4(y_mm)} mm below XY"


def quadrant_check_passes(declared: str, y_mm: float, z_mm: float) -> Tuple[bool, str]:
    d = declared.upper()
    if d == "FIRST":
        ok = z_mm >= -TOL_MM and y_mm >= -TOL_MM
        return ok, "1st quadrant requires z >= 0 (above/on HP) and y >= 0 (in front of/on VP)."
    if d == "SECOND":
        ok = z_mm >= -TOL_MM and y_mm <= TOL_MM
        return ok, "2nd quadrant requires z >= 0 (above/on HP) and y <= 0 (behind/on VP)."
    if d == "THIRD":
        ok = z_mm <= TOL_MM and y_mm <= TOL_MM
        return ok, "3rd quadrant requires z <= 0 (below/on HP) and y <= 0 (behind/on VP)."
    if d == "FOURTH":
        ok = z_mm <= TOL_MM and y_mm >= -TOL_MM
        return ok, "4th quadrant requires z <= 0 (below/on HP) and y >= 0 (in front of/on VP)."
    return True, ""


def solve_point_set(problem: Dict[str, Any]) -> Dict[str, Any]:
    geometry = problem.get("geometry") or {}
    points_raw = geometry.get("points") or []
    rel_relations = geometry.get("relative_relations") or []
    givens, _units, numeric_issues = extract_initial_values(problem)

    uncertain_readings = (problem.get("source") or {}).get("uncertain_readings") or []
    blocking_uncertainties = [
        u for u in uncertain_readings if isinstance(u, dict) and u.get("severity") == "blocking"
    ]
    if blocking_uncertainties:
        return {
            "ok": True,
            "solver_status": "ambiguous",
            "derived_values": {},
            "unresolved_unknowns": {
                k: "Blocked by uncertain OCR symbol reading requiring confirmation."
                for k in (problem.get("unknowns") or {}).keys()
            },
            "solved_coordinates": None,
            "solved_points": None,
            "missing_requirements": [],
            "issues": [
                {
                    "code": "BLOCKING_OCR_UNCERTAINTY",
                    "stage": "stage_3_python_solver",
                    "severity": "error",
                    "field": u.get("suspected_property"),
                    "message": f"Uncertain OCR reading '{u.get('raw_token')}': {u.get('reason')}",
                }
                for u in blocking_uncertainties
            ],
            "ambiguities": [
                {
                    "id": u.get("id", "ocr_uncertainty"),
                    "property": u.get("suspected_property") or "source_text",
                    "reason": u.get("reason", "Uncertain OCR reading."),
                    "candidates": (
                        [{"suggested": u.get("suggested_interpretation"), "raw": u.get("raw_token")}]
                        if u.get("suggested_interpretation")
                        else []
                    ),
                }
                for u in blocking_uncertainties
            ],
            "checks": [],
            "derivation": [],
        }

    issues: List[Dict[str, Any]] = list(numeric_issues)
    ambiguities: List[Dict[str, Any]] = []
    checks: List[Dict[str, Any]] = []
    derivation: List[Dict[str, Any]] = []
    derived_values: Dict[str, Dict[str, Any]] = {}

    # Preserve blocking parser errors (e.g. AMBIGUOUS_HP_SIDE / CONFLICTING_POINT_Z)
    existing_issues = (problem.get("validation") or {}).get("issues") or []
    has_parser_conflict = any(
        isinstance(i, dict) and i.get("severity") == "error" and str(i.get("code", "")).startswith("CONFLICTING_")
        for i in existing_issues
    )
    parser_ambig = [
        i
        for i in existing_issues
        if isinstance(i, dict) and i.get("severity") == "error" and str(i.get("code", "")).startswith("AMBIGUOUS_")
    ]
    for a in parser_ambig:
        ambiguities.append(
            {
                "id": str(a.get("code", "ambig")).lower(),
                "property": str(a.get("field") or "coordinate"),
                "reason": str(a.get("message") or "Ambiguous point side specification."),
                "candidates": [],
            }
        )

    is_single = len(points_raw) == 1
    point_state: Dict[str, Dict[str, Any]] = {}
    point_order: List[str] = []

    for idx, p in enumerate(points_raw):
        if not isinstance(p, dict):
            continue
        lbl = str(p.get("label") or f"P{idx + 1}").strip() or f"P{idx + 1}"
        prefix = "" if is_single else f"{lbl}."
        x_val = givens.get(f"{prefix}x_mm", p.get("x_mm"))
        y_val = givens.get(f"{prefix}y_mm", p.get("y_mm"))
        z_val = givens.get(f"{prefix}z_mm", p.get("z_mm"))

        point_state[lbl] = {
            "label": lbl,
            "prefix": prefix,
            "x_mm": float(x_val) if isinstance(x_val, (int, float)) else None,
            "y_mm": float(y_val) if isinstance(y_val, (int, float)) else None,
            "z_mm": float(z_val) if isinstance(z_val, (int, float)) else None,
            "declared_quadrant": p.get("declared_quadrant"),
            "x_is_layout_default": False,
        }
        point_order.append(lbl)

    def add_point_deriv(prop: str, val: float, deps: List[str], formula: str, explanation: str) -> None:
        if prop in givens:
            return
        derived_values[prop] = {
            "property": prop,
            "value": r4(val),
            "unit": "mm",
            "dependencies": deps,
            "formula": formula,
        }
        derivation.append(
            {
                "step": len(derivation) + 1,
                "formula": formula,
                "explanation": explanation,
                "result": f"{r4(val)} mm",
            }
        )

    # Propagate relative relations iteratively (both forward & inverse)
    for _ in range(16):
        changed = False
        for rel in rel_relations:
            if not isinstance(rel, dict):
                continue
            subj = str(rel.get("subject") or "").strip()
            ref = str(rel.get("reference") or "").strip()
            axis = str(rel.get("axis") or "").strip().lower()
            delta = rel.get("delta_mm")
            if subj not in point_state or ref not in point_state or axis not in ("x", "y", "z"):
                continue
            if not isinstance(delta, (int, float)) or not math.isfinite(delta):
                continue
            delta_f = float(delta)
            coord_key = f"{axis}_mm"
            s_val = point_state[subj][coord_key]
            r_val = point_state[ref][coord_key]

            if r_val is not None and s_val is None:
                computed = r_val + delta_f
                point_state[subj][coord_key] = computed
                prop_key = f"{point_state[subj]['prefix']}{coord_key}"
                ref_key = f"{point_state[ref]['prefix']}{coord_key}"
                add_point_deriv(
                    prop_key,
                    computed,
                    [ref_key],
                    f"{subj}.{axis} = {ref}.{axis} + ({r4(delta_f)})",
                    f"Derived {subj}.{coord_key} relative to point {ref} ({rel.get('excerpt', '')}).",
                )
                changed = True
            elif s_val is not None and r_val is None:
                computed = s_val - delta_f
                point_state[ref][coord_key] = computed
                prop_key = f"{point_state[ref]['prefix']}{coord_key}"
                subj_key = f"{point_state[subj]['prefix']}{coord_key}"
                add_point_deriv(
                    prop_key,
                    computed,
                    [subj_key],
                    f"{ref}.{axis} = {subj}.{axis} - ({r4(delta_f)})",
                    f"Derived {ref}.{coord_key} inversely from point {subj} ({rel.get('excerpt', '')}).",
                )
                changed = True
            elif s_val is not None and r_val is not None:
                diff = s_val - r_val
                if abs(diff - delta_f) > TOL_MM:
                    issues.append(
                        {
                            "code": "CONTRADICTORY_POINT_OFFSET",
                            "stage": "stage_3_python_solver",
                            "severity": "error",
                            "field": f"{point_state[subj]['prefix']}{coord_key}",
                            "message": (
                                f"Contradictory relative offset between {subj} and {ref} along {axis}: "
                                f"existing {subj}.{axis} - {ref}.{axis} = {r4(diff)} mm conflicts with stated {r4(delta_f)} mm."
                            ),
                        }
                    )
        if not changed:
            break

    # Assign clean lateral X layout defaults ONLY when x_mm was unstated (never alters y/z geometric validity)
    layout_cursor = 0.0
    for lbl in point_order:
        st = point_state[lbl]
        if st["x_mm"] is None:
            st["x_mm"] = layout_cursor
            st["x_is_layout_default"] = True
            layout_cursor += 65.0
            # Immediately propagate any x relative offsets from this anchor if needed
            for rel in rel_relations:
                if (
                    isinstance(rel, dict)
                    and rel.get("axis") == "x"
                    and rel.get("reference") == lbl
                    and isinstance(rel.get("delta_mm"), (int, float))
                ):
                    subj = str(rel.get("subject") or "")
                    if subj in point_state and point_state[subj]["x_mm"] is None:
                        point_state[subj]["x_mm"] = st["x_mm"] + float(rel["delta_mm"])
                        point_state[subj]["x_is_layout_default"] = True
        else:
            layout_cursor = max(layout_cursor + 65.0, float(st["x_mm"]) + 65.0)

    solved_points: List[Dict[str, Any]] = []
    missing_requirements: List[Dict[str, Any]] = []
    solved_count = 0
    underdet_count = 0

    for lbl in point_order:
        st = point_state[lbl]
        prefix = st["prefix"]
        x_val = st["x_mm"]
        y_val = st["y_mm"]
        z_val = st["z_mm"]
        s_low = lbl.lower()

        if st["declared_quadrant"] and y_val is not None and z_val is not None:
            ok_q, reason_q = quadrant_check_passes(str(st["declared_quadrant"]), y_val, z_val)
            checks.append(
                {
                    "id": f"check_quadrant_{lbl}",
                    "name": f"Point {lbl} Declared Quadrant Consistency",
                    "passed": ok_q,
                    "expected": str(st["declared_quadrant"]),
                    "actual": f"y={r4(y_val)}, z={r4(z_val)}",
                    "tolerance": TOL_MM,
                }
            )
            if not ok_q:
                issues.append(
                    {
                        "code": "CONTRADICTORY_QUADRANT",
                        "stage": "stage_3_python_solver",
                        "severity": "error",
                        "field": f"{prefix}z_mm",
                        "message": f"Point {lbl} contradicts declared {st['declared_quadrant']} quadrant: {reason_q}",
                    }
                )

        if y_val is None or z_val is None:
            underdet_count += 1
            if z_val is None:
                missing_requirements.append(
                    {
                        "id": f"missing_point_z_{lbl}",
                        "category": "coordinate",
                        "parameter": f"{prefix}z_mm",
                        "label": f"Height of Point {lbl} from HP (z)",
                        "unit": "mm",
                        "alternatives": [f"{prefix}z_mm"],
                        "reason": f"Distance of point {lbl} above/below/on HP is not determined.",
                        "example_fix": f"Specify '{lbl} is 20 mm above HP', 'below HP', or 'in HP'.",
                    }
                )
            if y_val is None:
                missing_requirements.append(
                    {
                        "id": f"missing_point_y_{lbl}",
                        "category": "coordinate",
                        "parameter": f"{prefix}y_mm",
                        "label": f"Depth of Point {lbl} from VP (y)",
                        "unit": "mm",
                        "alternatives": [f"{prefix}y_mm"],
                        "reason": f"Distance of point {lbl} in front of/behind/on VP is not determined.",
                        "example_fix": f"Specify '{lbl} is 30 mm in front of VP', 'behind VP', or 'in VP'.",
                    }
                )

            solved_points.append(
                {
                    "label": lbl,
                    "status": "underdetermined",
                    "x_mm": r4(x_val) if x_val is not None else None,
                    "x_is_layout_default": st["x_is_layout_default"],
                    "y_mm": r4(y_val) if y_val is not None else None,
                    "z_mm": r4(z_val) if z_val is not None else None,
                    "hp_relation": None if z_val is None else ("on" if abs(z_val) <= TOL_MM else ("above" if z_val > 0 else "below")),
                    "vp_relation": None if y_val is None else ("on" if abs(y_val) <= TOL_MM else ("in_front" if y_val > 0 else "behind")),
                    "front_view_y": r4(z_val) if z_val is not None else None,
                    "top_view_y": r4(-y_val) if y_val is not None else None,
                    "front_view_label": f"{s_low}′",
                    "top_view_label": s_low,
                    "quadrant": None,
                    "valid_quadrants": [],
                    "front_view_desc": f"{r4(z_val)} mm {'above' if z_val >= 0 else 'below'} XY" if z_val is not None else "Unresolved",
                    "top_view_desc": f"{r4(abs(y_val))} mm {'below' if y_val >= 0 else 'above'} XY" if y_val is not None else "Unresolved",
                    "explanation": f"Point {lbl} is missing required HP/VP coordinate constraints.",
                }
            )
            continue

        # Solved point coordinates under First-Angle BIS SP 46:2003 unfolding:
        # Front view vertical offset = +z (above XY when z > 0)
        # Top view vertical offset   = -y (below XY when y > 0, i.e., in front of VP)
        fv_y = float(z_val)
        tv_y = float(-y_val)
        quad_name, valid_quads, fv_desc, tv_desc = classify_point_quadrant(y_val, z_val)
        hp_rel = "on" if abs(z_val) <= TOL_MM else ("above" if z_val > 0 else "below")
        vp_rel = "on" if abs(y_val) <= TOL_MM else ("in_front" if y_val > 0 else "behind")

        add_point_deriv(
            f"{prefix}front_view_y",
            fv_y,
            [f"{prefix}z_mm"],
            f"front_view_y({s_low}′) = z = {r4(z_val)}",
            f"Front view {s_low}′ sits at {fv_desc} (z = {r4(z_val)} mm).",
        )
        add_point_deriv(
            f"{prefix}top_view_y",
            tv_y,
            [f"{prefix}y_mm"],
            f"top_view_y({s_low}) = -y = {r4(-y_val)}",
            f"Top view {s_low} sits at {tv_desc} (-y = {r4(-y_val)} mm).",
        )
        if f"{prefix}x_mm" not in givens and not st["x_is_layout_default"] and x_val is not None:
            add_point_deriv(
                f"{prefix}x_mm",
                float(x_val),
                [],
                f"{lbl}.x = {r4(float(x_val))}",
                f"Lateral position of {lbl} along XY is {r4(float(x_val))} mm.",
            )

        checks.extend(
            [
                {
                    "id": f"check_point_fv_{lbl}",
                    "name": f"Point {lbl} Front View Projection (front_view_y == z)",
                    "passed": abs(fv_y - z_val) <= 1e-4,
                    "expected": f"{r4(z_val)} mm",
                    "actual": f"{r4(fv_y)} mm",
                    "tolerance": 1e-4,
                },
                {
                    "id": f"check_point_tv_{lbl}",
                    "name": f"Point {lbl} Top View Projection (top_view_y == -y)",
                    "passed": abs(tv_y + y_val) <= 1e-4,
                    "expected": f"{r4(-y_val)} mm",
                    "actual": f"{r4(tv_y)} mm",
                    "tolerance": 1e-4,
                },
            ]
        )

        solved_count += 1
        solved_points.append(
            {
                "label": lbl,
                "status": "solved",
                "x_mm": r4(float(x_val)) if x_val is not None else 0.0,
                "x_is_layout_default": st["x_is_layout_default"],
                "y_mm": r4(y_val),
                "z_mm": r4(z_val),
                "hp_relation": hp_rel,
                "vp_relation": vp_rel,
                "front_view_y": r4(fv_y),
                "top_view_y": r4(tv_y),
                "front_view_label": f"{s_low}′",
                "top_view_label": s_low,
                "quadrant": quad_name,
                "valid_quadrants": valid_quads,
                "front_view_desc": fv_desc,
                "top_view_desc": tv_desc,
                "explanation": (
                    f"Point {lbl} lies at (y={r4(y_val)} mm, z={r4(z_val)} mm) in {quad_name}. "
                    f"FV {s_low}′ is {fv_desc}; TV {s_low} is {tv_desc}."
                ),
            }
        )

    unresolved_unknowns: Dict[str, str] = {}
    for prop in (problem.get("unknowns") or {}).keys():
        if prop in derived_values or prop in givens:
            continue
        if prop.endswith("x_mm") and solved_count > 0:
            unresolved_unknowns[prop] = "X position along XY not specified in question; assigned clean projector spacing for display."
        else:
            unresolved_unknowns[prop] = f"Underdetermined: insufficient constraints to solve '{prop}'."

    has_error_issue = has_parser_conflict or any(i.get("severity") == "error" for i in issues)
    if has_error_issue:
        solver_status = "inconsistent"
    elif ambiguities:
        solver_status = "ambiguous"
    elif underdet_count > 0 and solved_count > 0:
        solver_status = "partially_solved"
    elif underdet_count > 0 or solved_count == 0:
        solver_status = "underdetermined"
        issues.append(
            {
                "code": "UNDERDETERMINED_SYSTEM",
                "stage": "stage_3_python_solver",
                "severity": "warning",
                "field": missing_requirements[0]["parameter"] if missing_requirements else None,
                "message": "Point projection is underdetermined: provide distances to both HP and VP.",
            }
        )
    else:
        solver_status = "solved"

    return {
        "ok": True,
        "solver_status": solver_status,
        "derived_values": derived_values if solver_status != "inconsistent" else {},
        "unresolved_unknowns": unresolved_unknowns,
        "solved_coordinates": None,
        "solved_points": solved_points if solver_status != "inconsistent" else None,
        "missing_requirements": missing_requirements,
        "issues": issues,
        "ambiguities": ambiguities,
        "checks": checks,
        "derivation": derivation,
    }


def diagnose_missing_constraints(
    known: Dict[str, float],
    abs_dz: Optional[float],
    abs_dy: Optional[float],
    flags: Dict[str, bool],
    start_lbl: str,
    end_lbl: str,
    missing_required: List[str],
) -> List[Dict[str, Any]]:
    """
    Analyze an underdetermined straight-line projection system and return the exact
    minimal geometric parameters needed to lock the remaining degrees of freedom.
    """
    if not missing_required:
        return []

    line_lbl = f"{start_lbl}{end_lbl}"
    requirements: List[Dict[str, Any]] = []

    has_scale = (
        "true_length" in known
        or "front_view_length" in known
        or "top_view_length" in known
        or "dep" in known
        or (abs_dz is not None and abs_dz > TOL_MM)
        or (abs_dy is not None and abs_dy > TOL_MM)
    )
    has_hp_orientation = (
        "theta_hp" in known
        or flags.get("parallel_hp", False)
        or flags.get("perpendicular_hp", False)
        or flags.get("perpendicular_vp", False)
    )
    has_vp_orientation = (
        "phi_vp" in known
        or flags.get("parallel_vp", False)
        or flags.get("perpendicular_vp", False)
        or flags.get("perpendicular_hp", False)
    )

    if not has_scale:
        requirements.append(
            {
                "id": "missing_scale_length",
                "category": "length",
                "parameter": "true_length",
                "label": f"True Length (TL) of Line {line_lbl}",
                "unit": "mm",
                "alternatives": ["true_length", "front_view_length", "top_view_length", "dep"],
                "reason": (
                    f"No linear length measurement is available for Line {line_lbl}. "
                    "At least one length (TL, FV, TV, or DEP) is required to establish scale."
                ),
                "example_fix": f"Add true length (e.g., 'line {line_lbl} 80 mm long') or a projected view length.",
            }
        )

    if not has_hp_orientation:
        alts = ["theta_hp"]
        if "true_length" in known:
            alts.append("top_view_length")
        if "start_z_hp" in known and "end_z_hp" not in known:
            alts.append("end_z_hp")
        elif "end_z_hp" in known and "start_z_hp" not in known:
            alts.append("start_z_hp")
        if "front_view_length" in known or "dep" in known:
            alts.append("alpha_fv")

        requirements.append(
            {
                "id": "missing_hp_inclination",
                "category": "inclination",
                "parameter": "theta_hp",
                "label": "Inclination with HP (θ) or HP Orientation",
                "unit": "deg",
                "alternatives": alts,
                "reason": (
                    f"The angle of Line {line_lbl} with the Horizontal Plane (HP) cannot be derived from the given values."
                ),
                "example_fix": (
                    f"Specify inclination with HP (e.g., 'inclined at 30° to HP' or 'parallel to HP'), "
                    f"or provide one of: {', '.join(alts[1:]) if len(alts) > 1 else 'top_view_length / end_z_hp'}."
                ),
            }
        )

    if not has_vp_orientation:
        alts = ["phi_vp"]
        if "true_length" in known:
            alts.append("front_view_length")
        if "start_y_vp" in known and "end_y_vp" not in known:
            alts.append("end_y_vp")
        elif "end_y_vp" in known and "start_y_vp" not in known:
            alts.append("start_y_vp")
        if "top_view_length" in known or "dep" in known:
            alts.append("beta_tv")

        requirements.append(
            {
                "id": "missing_vp_inclination",
                "category": "inclination",
                "parameter": "phi_vp",
                "label": "Inclination with VP (φ) or VP Orientation",
                "unit": "deg",
                "alternatives": alts,
                "reason": (
                    f"The angle of Line {line_lbl} with the Vertical Plane (VP) cannot be derived from the given values."
                ),
                "example_fix": (
                    f"Specify inclination with VP (e.g., 'inclined at 45° to VP' or 'parallel to VP'), "
                    f"or provide one of: {', '.join(alts[1:]) if len(alts) > 1 else 'front_view_length / end_y_vp'}."
                ),
            }
        )

    if (
        has_scale
        and abs_dz is not None
        and abs_dy is not None
        and "dep" not in known
        and "true_length" not in known
        and not has_hp_orientation
        and not has_vp_orientation
    ):
        requirements = [r for r in requirements if r["id"] not in ("missing_hp_inclination", "missing_vp_inclination")]
        requirements.append(
            {
                "id": "missing_horizontal_coupling",
                "category": "distance",
                "parameter": "dep",
                "label": "Distance Between End Projectors (DEP) or True Length (TL)",
                "unit": "mm",
                "alternatives": ["dep", "true_length", "front_view_length", "top_view_length", "theta_hp", "phi_vp"],
                "reason": (
                    f"Both vertical height difference (|Δz| = {r4(abs_dz)} mm) and depth difference (|Δy| = {r4(abs_dy)} mm) "
                    "are known, leaving 1 remaining shape degree of freedom along the XY axis."
                ),
                "example_fix": "Provide DEP, true length (TL), FV/TV length, or one true inclination angle.",
            }
        )

    if "start_z_hp" not in known and "end_z_hp" not in known:
        requirements.append(
            {
                "id": "missing_hp_position",
                "category": "position",
                "parameter": "start_z_hp",
                "label": f"Distance of Endpoint {start_lbl} from HP",
                "unit": "mm",
                "alternatives": ["start_z_hp", "end_z_hp"],
                "reason": (
                    f"Neither endpoint {start_lbl} nor endpoint {end_lbl} has a known distance above/below/on HP "
                    "to anchor the Front View relative to the XY line."
                ),
                "example_fix": f"Specify end {start_lbl} height from HP (e.g., 'end {start_lbl} is 20 mm above HP').",
            }
        )
    elif "start_z_hp" not in known and "end_z_hp" in known and abs_dz is None:
        requirements.append(
            {
                "id": "missing_start_hp_position",
                "category": "position",
                "parameter": "start_z_hp",
                "label": f"Distance of Endpoint {start_lbl} from HP",
                "unit": "mm",
                "alternatives": ["start_z_hp", "theta_hp"],
                "reason": f"Endpoint {end_lbl} height is known, but {start_lbl} height cannot be computed without |Δz|.",
                "example_fix": f"Specify endpoint {start_lbl} distance from HP or provide θ.",
            }
        )

    if "start_y_vp" not in known and "end_y_vp" not in known:
        requirements.append(
            {
                "id": "missing_vp_position",
                "category": "position",
                "parameter": "start_y_vp",
                "label": f"Distance of Endpoint {start_lbl} from VP",
                "unit": "mm",
                "alternatives": ["start_y_vp", "end_y_vp"],
                "reason": (
                    f"Neither endpoint {start_lbl} nor endpoint {end_lbl} has a known distance in front of/behind/on VP "
                    "to anchor the Top View relative to the XY line."
                ),
                "example_fix": f"Specify end {start_lbl} distance from VP (e.g., 'end {start_lbl} is 30 mm in front of VP').",
            }
        )
    elif "start_y_vp" not in known and "end_y_vp" in known and abs_dy is None:
        requirements.append(
            {
                "id": "missing_start_vp_position",
                "category": "position",
                "parameter": "start_y_vp",
                "label": f"Distance of Endpoint {start_lbl} from VP",
                "unit": "mm",
                "alternatives": ["start_y_vp", "phi_vp"],
                "reason": f"Endpoint {end_lbl} distance from VP is known, but {start_lbl} distance cannot be computed without |Δy|.",
                "example_fix": f"Specify endpoint {start_lbl} distance from VP or provide φ.",
            }
        )

    if not requirements and missing_required:
        first_prop = missing_required[0]
        requirements.append(
            {
                "id": f"missing_{first_prop}",
                "category": "distance" if first_prop in ("dep", "true_length", "front_view_length", "top_view_length") else "orientation",
                "parameter": first_prop,
                "label": f"Missing Constraint for {first_prop}",
                "unit": "deg" if first_prop in ("theta_hp", "phi_vp", "alpha_fv", "beta_tv") else "mm",
                "alternatives": list(missing_required),
                "reason": f"Additional independent constraint needed to solve [{', '.join(missing_required)}].",
                "example_fix": f"Provide an explicit value for {first_prop} or a related projection measurement.",
            }
        )

    return requirements


def solve_straight_line(problem: Dict[str, Any]) -> Dict[str, Any]:
    geometry = problem.get("geometry", {})
    if geometry.get("entity_type") != "straight_line":
        return {
            "ok": False,
            "solver_status": "error",
            "derived_values": {},
            "unresolved_unknowns": {},
            "solved_coordinates": None,
            "solved_points": None,
            "missing_requirements": [],
            "issues": [
                {
                    "code": "UNSUPPORTED_ENTITY_TYPE",
                    "stage": "stage_3_python_solver",
                    "severity": "error",
                    "field": "geometry.entity_type",
                    "message": f"Straight-line solver received incompatible entity_type '{geometry.get('entity_type')}'.",
                }
            ],
            "ambiguities": [],
            "checks": [],
            "derivation": [],
        }

    uncertain_readings = (problem.get("source") or {}).get("uncertain_readings") or []
    blocking_uncertainties = [u for u in uncertain_readings if isinstance(u, dict) and u.get("severity") == "blocking"]
    if blocking_uncertainties:
        return {
            "ok": True,
            "solver_status": "ambiguous",
            "derived_values": {},
            "unresolved_unknowns": {
                prop: "Blocked by uncertain OCR symbol reading that requires user confirmation."
                for prop in (problem.get("unknowns") or {}).keys()
            },
            "solved_coordinates": None,
            "solved_points": None,
            "missing_requirements": [],
            "issues": [
                {
                    "code": "BLOCKING_OCR_UNCERTAINTY",
                    "stage": "stage_3_python_solver",
                    "severity": "error",
                    "field": u.get("suspected_property"),
                    "message": f"Uncertain OCR reading '{u.get('raw_token')}': {u.get('reason')}",
                }
                for u in blocking_uncertainties
            ],
            "ambiguities": [
                {
                    "id": u.get("id", "ocr_uncertainty"),
                    "property": u.get("suspected_property") or "source_text",
                    "reason": u.get("reason", "Uncertain OCR reading."),
                    "candidates": (
                        [{"suggested": u.get("suggested_interpretation"), "raw": u.get("raw_token")}]
                        if u.get("suggested_interpretation")
                        else []
                    ),
                }
                for u in blocking_uncertainties
            ],
            "checks": [],
            "derivation": [],
        }

    givens, _units, issues = extract_initial_values(problem)
    flags = extract_constraint_flags(problem)
    quadrant_hints = geometry.get("quadrant_hints") or {}
    endpoints = geometry.get("endpoints") or {"start": "A", "end": "B"}
    start_lbl = str(endpoints.get("start", "A")).strip() or "A"
    end_lbl = str(endpoints.get("end", "B")).strip() or "B"

    known: Dict[str, float] = dict(givens)
    derived_meta: Dict[str, Dict[str, Any]] = {}
    contradictions: List[Dict[str, Any]] = list(issues)
    ambiguities: List[Dict[str, Any]] = []
    checks: List[Dict[str, Any]] = []
    derivation: List[Dict[str, Any]] = []

    def add_contradiction(code: str, field: Optional[str], message: str) -> None:
        contradictions.append(
            {
                "code": code,
                "stage": "stage_3_python_solver",
                "severity": "error",
                "field": field,
                "message": message,
            }
        )

    def set_or_check(
        prop: str,
        value: float,
        unit: str,
        deps: List[str],
        formula: str,
        tol: Optional[float] = None,
    ) -> bool:
        if not math.isfinite(value):
            add_contradiction("NON_FINITE_RESULT", prop, f"Computed non-finite value for {prop}.")
            return False
        effective_tol = tol if tol is not None else (TOL_DEG if unit == "deg" else TOL_MM)
        if prop in known:
            if abs(known[prop] - value) > effective_tol:
                add_contradiction(
                    "CONTRADICTORY_CONSTRAINT",
                    prop,
                    f"Contradiction for '{prop}': existing value {r4(known[prop])} {unit} conflicts with {formula} = {r4(value)} {unit}.",
                )
            return False
        known[prop] = value
        derived_meta[prop] = {
            "property": prop,
            "value": r4(value),
            "unit": unit,
            "dependencies": list(dict.fromkeys(deps)),
            "formula": formula,
        }
        derivation.append(
            {
                "step": len(derivation) + 1,
                "formula": f"{prop} = {formula}",
                "explanation": f"Derived {prop} from {', '.join(dict.fromkeys(deps))}.",
                "result": f"{r4(value)} {unit}",
            }
        )
        return True

    # Physical domain checks on givens
    for length_prop in ("true_length", "front_view_length", "top_view_length", "dep", "abs_delta_z", "abs_delta_y"):
        if length_prop in givens and givens[length_prop] < -TOL_MM:
            add_contradiction(
                "NEGATIVE_LENGTH",
                length_prop,
                f"'{length_prop}' cannot be negative ({givens[length_prop]} mm).",
            )
    if "true_length" in givens and givens["true_length"] <= TOL_MM:
        add_contradiction(
            "ZERO_TRUE_LENGTH",
            "true_length",
            f"True length must be strictly greater than 0 mm (got {givens['true_length']} mm).",
        )

    for angle_prop in ("theta_hp", "phi_vp", "alpha_fv", "beta_tv"):
        if angle_prop in givens:
            ang = givens[angle_prop]
            if ang < -TOL_DEG or ang > 90.0 + TOL_DEG:
                add_contradiction(
                    "ANGLE_OUT_OF_RANGE",
                    angle_prop,
                    f"Angle '{angle_prop}' = {ang}° must be between 0° and 90°.",
                )

    if flags["perpendicular_hp"] and flags["perpendicular_vp"]:
        add_contradiction("IMPOSSIBLE_ORIENTATION", "constraints", "A straight line cannot be simultaneously perpendicular to both HP and VP.")
    if flags["perpendicular_hp"] and flags["parallel_hp"]:
        add_contradiction("IMPOSSIBLE_ORIENTATION", "constraints", "A straight line cannot be both parallel and perpendicular to HP.")
    if flags["perpendicular_vp"] and flags["parallel_vp"]:
        add_contradiction("IMPOSSIBLE_ORIENTATION", "constraints", "A straight line cannot be both parallel and perpendicular to VP.")

    if flags["perpendicular_hp"]:
        set_or_check("theta_hp", 90.0, "deg", ["constraint:perpendicular_hp"], "perpendicular to HP => 90 deg")
        set_or_check("phi_vp", 0.0, "deg", ["constraint:perpendicular_hp"], "perpendicular to HP => parallel to VP => 0 deg")
        set_or_check("dep", 0.0, "mm", ["constraint:perpendicular_hp"], "perpendicular to HP => 0 mm")
        set_or_check("top_view_length", 0.0, "mm", ["constraint:perpendicular_hp"], "perpendicular to HP => 0 mm (point view)")

    if flags["perpendicular_vp"]:
        set_or_check("phi_vp", 90.0, "deg", ["constraint:perpendicular_vp"], "perpendicular to VP => 90 deg")
        set_or_check("theta_hp", 0.0, "deg", ["constraint:perpendicular_vp"], "perpendicular to VP => parallel to HP => 0 deg")
        set_or_check("dep", 0.0, "mm", ["constraint:perpendicular_vp"], "perpendicular to VP => 0 mm")
        set_or_check("front_view_length", 0.0, "mm", ["constraint:perpendicular_vp"], "perpendicular to VP => 0 mm (point view)")

    if flags["parallel_hp"]:
        set_or_check("theta_hp", 0.0, "deg", ["constraint:parallel_hp"], "parallel to HP => 0 deg")
        set_or_check("alpha_fv", 0.0, "deg", ["constraint:parallel_hp"], "parallel to HP => 0 deg")

    if flags["parallel_vp"]:
        set_or_check("phi_vp", 0.0, "deg", ["constraint:parallel_vp"], "parallel to VP => 0 deg")
        set_or_check("beta_tv", 0.0, "deg", ["constraint:parallel_vp"], "parallel to VP => 0 deg")

    abs_dz: Optional[float] = None
    abs_dz_deps: List[str] = []
    abs_dz_formula: str = ""
    signed_dz: Optional[float] = None
    signed_dz_deps: List[str] = []
    signed_dz_formula: str = ""

    abs_dy: Optional[float] = None
    abs_dy_deps: List[str] = []
    abs_dy_formula: str = ""
    signed_dy: Optional[float] = None
    signed_dy_deps: List[str] = []
    signed_dy_formula: str = ""

    def set_or_check_abs_dz(val: float, deps: List[str], formula: str) -> bool:
        nonlocal abs_dz, abs_dz_deps, abs_dz_formula
        if val < -TOL_MM:
            add_contradiction("NEGATIVE_DZ", "end_z_hp", f"Computed |dz| is negative ({r4(val)} mm).")
            return False
        val = max(0.0, val)
        if abs_dz is not None:
            if abs(abs_dz - val) > TOL_MM:
                add_contradiction(
                    "CONTRADICTORY_DZ",
                    "end_z_hp",
                    f"Contradiction in vertical height difference |dz|: {r4(abs_dz)} mm vs {formula} = {r4(val)} mm.",
                )
            return False
        abs_dz = val
        abs_dz_deps = list(dict.fromkeys(deps))
        abs_dz_formula = formula
        return True

    def set_or_check_abs_dy(val: float, deps: List[str], formula: str) -> bool:
        nonlocal abs_dy, abs_dy_deps, abs_dy_formula
        if val < -TOL_MM:
            add_contradiction("NEGATIVE_DY", "end_y_vp", f"Computed |dy| is negative ({r4(val)} mm).")
            return False
        val = max(0.0, val)
        if abs_dy is not None:
            if abs(abs_dy - val) > TOL_MM:
                add_contradiction(
                    "CONTRADICTORY_DY",
                    "end_y_vp",
                    f"Contradiction in depth difference |dy|: {r4(abs_dy)} mm vs {formula} = {r4(val)} mm.",
                )
            return False
        abs_dy = val
        abs_dy_deps = list(dict.fromkeys(deps))
        abs_dy_formula = formula
        return True

    # Seed from explicit abs_delta_z / abs_delta_y if provided
    if "abs_delta_z" in givens:
        set_or_check_abs_dz(givens["abs_delta_z"], ["abs_delta_z"], "given abs_delta_z")
    if "abs_delta_y" in givens:
        set_or_check_abs_dy(givens["abs_delta_y"], ["abs_delta_y"], "given abs_delta_y")

    # Fixed-point deductive propagation
    for _ in range(16):
        changed = False

        if "start_z_hp" in known and "end_z_hp" in known:
            dz_val = known["end_z_hp"] - known["start_z_hp"]
            signed_dz = dz_val
            signed_dz_deps = ["start_z_hp", "end_z_hp"]
            signed_dz_formula = "end_z_hp - start_z_hp"
            if set_or_check_abs_dz(abs(dz_val), ["start_z_hp", "end_z_hp"], "|end_z_hp - start_z_hp|"):
                changed = True

        if "start_y_vp" in known and "end_y_vp" in known:
            dy_val = known["end_y_vp"] - known["start_y_vp"]
            signed_dy = dy_val
            signed_dy_deps = ["start_y_vp", "end_y_vp"]
            signed_dy_formula = "end_y_vp - start_y_vp"
            if set_or_check_abs_dy(abs(dy_val), ["start_y_vp", "end_y_vp"], "|end_y_vp - start_y_vp|"):
                changed = True

        if flags["parallel_hp"] or ("theta_hp" in known and abs(known["theta_hp"]) < TOL_DEG):
            if set_or_check_abs_dz(0.0, ["theta_hp"], "theta_hp = 0 => 0"):
                changed = True
            signed_dz = 0.0
            signed_dz_deps = ["theta_hp"]
            signed_dz_formula = "theta_hp = 0 => dz = 0"
            if "start_z_hp" in known:
                if set_or_check("end_z_hp", known["start_z_hp"], "mm", ["start_z_hp", "theta_hp"], "start_z_hp (parallel to HP)"):
                    changed = True
            elif "end_z_hp" in known:
                if set_or_check("start_z_hp", known["end_z_hp"], "mm", ["end_z_hp", "theta_hp"], "end_z_hp (parallel to HP)"):
                    changed = True

        if flags["parallel_vp"] or ("phi_vp" in known and abs(known["phi_vp"]) < TOL_DEG):
            if set_or_check_abs_dy(0.0, ["phi_vp"], "phi_vp = 0 => 0"):
                changed = True
            signed_dy = 0.0
            signed_dy_deps = ["phi_vp"]
            signed_dy_formula = "phi_vp = 0 => dy = 0"
            if "start_y_vp" in known:
                if set_or_check("end_y_vp", known["start_y_vp"], "mm", ["start_y_vp", "phi_vp"], "start_y_vp (parallel to VP)"):
                    changed = True
            elif "end_y_vp" in known:
                if set_or_check("start_y_vp", known["end_y_vp"], "mm", ["end_y_vp", "phi_vp"], "end_y_vp (parallel to VP)"):
                    changed = True

        if "theta_hp" in known and "phi_vp" in known:
            th = known["theta_hp"]
            ph = known["phi_vp"]
            sin2_sum = math.sin(deg2rad(th)) ** 2 + math.sin(deg2rad(ph)) ** 2
            if sin2_sum > 1.0 + 1e-4:
                add_contradiction(
                    "ANGLE_SUM_EXCEEDS_90",
                    "theta_hp",
                    f"Geometrically impossible inclinations: theta ({r4(th)}°) + phi ({r4(ph)}°) exceeds 90° (sin²θ + sin²φ = {sin2_sum:.4f} > 1).",
                )

        if "true_length" in known and "theta_hp" in known:
            tl = known["true_length"]
            th = known["theta_hp"]
            if set_or_check("top_view_length", tl * math.cos(deg2rad(th)), "mm", ["true_length", "theta_hp"], "true_length * cos(theta_hp)"):
                changed = True
            if set_or_check_abs_dz(tl * math.sin(deg2rad(th)), ["true_length", "theta_hp"], "true_length * sin(theta_hp)"):
                changed = True

        if "true_length" in known and "phi_vp" in known:
            tl = known["true_length"]
            ph = known["phi_vp"]
            if set_or_check("front_view_length", tl * math.cos(deg2rad(ph)), "mm", ["true_length", "phi_vp"], "true_length * cos(phi_vp)"):
                changed = True
            if set_or_check_abs_dy(tl * math.sin(deg2rad(ph)), ["true_length", "phi_vp"], "true_length * sin(phi_vp)"):
                changed = True

        if "top_view_length" in known and "theta_hp" in known:
            cos_th = math.cos(deg2rad(known["theta_hp"]))
            if cos_th > 1e-5:
                if set_or_check("true_length", known["top_view_length"] / cos_th, "mm", ["top_view_length", "theta_hp"], "top_view_length / cos(theta_hp)"):
                    changed = True

        if "front_view_length" in known and "phi_vp" in known:
            cos_ph = math.cos(deg2rad(known["phi_vp"]))
            if cos_ph > 1e-5:
                if set_or_check("true_length", known["front_view_length"] / cos_ph, "mm", ["front_view_length", "phi_vp"], "front_view_length / cos(phi_vp)"):
                    changed = True

        if "true_length" in known and "top_view_length" in known and known["true_length"] > TOL_MM:
            ratio = known["top_view_length"] / known["true_length"]
            if ratio > 1.0 + TOL_TRIG:
                add_contradiction(
                    "TV_EXCEEDS_TL",
                    "top_view_length",
                    f"Top view length ({r4(known['top_view_length'])} mm) cannot exceed true length ({r4(known['true_length'])} mm).",
                )
            elif ratio >= -TOL_TRIG:
                th_val = rad2deg(math.acos(clamp_unit(max(0.0, ratio))))
                if set_or_check("theta_hp", th_val, "deg", ["true_length", "top_view_length"], "acos(top_view_length / true_length)"):
                    changed = True

        if "true_length" in known and "front_view_length" in known and known["true_length"] > TOL_MM:
            ratio = known["front_view_length"] / known["true_length"]
            if ratio > 1.0 + TOL_TRIG:
                add_contradiction(
                    "FV_EXCEEDS_TL",
                    "front_view_length",
                    f"Front view length ({r4(known['front_view_length'])} mm) cannot exceed true length ({r4(known['true_length'])} mm).",
                )
            elif ratio >= -TOL_TRIG:
                ph_val = rad2deg(math.acos(clamp_unit(max(0.0, ratio))))
                if set_or_check("phi_vp", ph_val, "deg", ["true_length", "front_view_length"], "acos(front_view_length / true_length)"):
                    changed = True

        if "true_length" in known and abs_dz is not None and known["true_length"] > TOL_MM:
            ratio = abs_dz / known["true_length"]
            if ratio > 1.0 + TOL_TRIG:
                add_contradiction(
                    "DZ_EXCEEDS_TL",
                    "end_z_hp",
                    f"Height difference |dz| ({r4(abs_dz)} mm) exceeds true length ({r4(known['true_length'])} mm).",
                )
            else:
                th_val = rad2deg(math.asin(clamp_unit(ratio)))
                if set_or_check("theta_hp", th_val, "deg", ["true_length"] + abs_dz_deps, "asin(|dz| / true_length)"):
                    changed = True

        if "true_length" in known and abs_dy is not None and known["true_length"] > TOL_MM:
            ratio = abs_dy / known["true_length"]
            if ratio > 1.0 + TOL_TRIG:
                add_contradiction(
                    "DY_EXCEEDS_TL",
                    "end_y_vp",
                    f"Depth difference |dy| ({r4(abs_dy)} mm) exceeds true length ({r4(known['true_length'])} mm).",
                )
            else:
                ph_val = rad2deg(math.asin(clamp_unit(ratio)))
                if set_or_check("phi_vp", ph_val, "deg", ["true_length"] + abs_dy_deps, "asin(|dy| / true_length)"):
                    changed = True

        if abs_dz is not None and "theta_hp" in known:
            sin_th = math.sin(deg2rad(known["theta_hp"]))
            if sin_th > 1e-5:
                if set_or_check("true_length", abs_dz / sin_th, "mm", abs_dz_deps + ["theta_hp"], "|dz| / sin(theta_hp)"):
                    changed = True

        if abs_dy is not None and "phi_vp" in known:
            sin_ph = math.sin(deg2rad(known["phi_vp"]))
            if sin_ph > 1e-5:
                if set_or_check("true_length", abs_dy / sin_ph, "mm", abs_dy_deps + ["phi_vp"], "|dy| / sin(phi_vp)"):
                    changed = True

        if "dep" in known and abs_dz is not None:
            fv_val = math.hypot(known["dep"], abs_dz)
            if set_or_check("front_view_length", fv_val, "mm", ["dep"] + abs_dz_deps, "sqrt(dep^2 + dz^2)"):
                changed = True

        if "dep" in known and abs_dy is not None:
            tv_val = math.hypot(known["dep"], abs_dy)
            if set_or_check("top_view_length", tv_val, "mm", ["dep"] + abs_dy_deps, "sqrt(dep^2 + dy^2)"):
                changed = True

        if "dep" in known and abs_dz is not None and abs_dy is not None:
            tl_val = math.sqrt(known["dep"] ** 2 + abs_dy ** 2 + abs_dz ** 2)
            if set_or_check("true_length", tl_val, "mm", ["dep"] + abs_dy_deps + abs_dz_deps, "sqrt(dep^2 + dy^2 + dz^2)"):
                changed = True

        if "front_view_length" in known and abs_dz is not None:
            diff_sq = known["front_view_length"] ** 2 - abs_dz ** 2
            if diff_sq < -TOL_MM * max(1.0, known["front_view_length"]):
                add_contradiction(
                    "DZ_EXCEEDS_FV",
                    "front_view_length",
                    f"|dz| ({r4(abs_dz)} mm) cannot exceed front view length ({r4(known['front_view_length'])} mm).",
                )
            else:
                if set_or_check("dep", math.sqrt(max(0.0, diff_sq)), "mm", ["front_view_length"] + abs_dz_deps, "sqrt(front_view_length^2 - dz^2)"):
                    changed = True

        if "top_view_length" in known and abs_dy is not None:
            diff_sq = known["top_view_length"] ** 2 - abs_dy ** 2
            if diff_sq < -TOL_MM * max(1.0, known["top_view_length"]):
                add_contradiction(
                    "DY_EXCEEDS_TV",
                    "top_view_length",
                    f"|dy| ({r4(abs_dy)} mm) cannot exceed top view length ({r4(known['top_view_length'])} mm).",
                )
            else:
                if set_or_check("dep", math.sqrt(max(0.0, diff_sq)), "mm", ["top_view_length"] + abs_dy_deps, "sqrt(top_view_length^2 - dy^2)"):
                    changed = True

        if "front_view_length" in known and "dep" in known:
            diff_sq = known["front_view_length"] ** 2 - known["dep"] ** 2
            if diff_sq < -TOL_MM * max(1.0, known["front_view_length"]):
                add_contradiction(
                    "DEP_EXCEEDS_FV",
                    "dep",
                    f"DEP ({r4(known['dep'])} mm) cannot exceed front view length ({r4(known['front_view_length'])} mm).",
                )
            else:
                if set_or_check_abs_dz(math.sqrt(max(0.0, diff_sq)), ["front_view_length", "dep"], "sqrt(front_view_length^2 - dep^2)"):
                    changed = True

        if "top_view_length" in known and "dep" in known:
            diff_sq = known["top_view_length"] ** 2 - known["dep"] ** 2
            if diff_sq < -TOL_MM * max(1.0, known["top_view_length"]):
                add_contradiction(
                    "DEP_EXCEEDS_TV",
                    "dep",
                    f"DEP ({r4(known['dep'])} mm) cannot exceed top view length ({r4(known['top_view_length'])} mm).",
                )
            else:
                if set_or_check_abs_dy(math.sqrt(max(0.0, diff_sq)), ["top_view_length", "dep"], "sqrt(top_view_length^2 - dep^2)"):
                    changed = True

        if "true_length" in known and abs_dy is not None and abs_dz is not None:
            dx_sq = known["true_length"] ** 2 - abs_dy ** 2 - abs_dz ** 2
            if dx_sq < -TOL_MM * max(1.0, known["true_length"]):
                add_contradiction(
                    "INVALID_3D_PYTHAGORAS",
                    "dep",
                    f"dy² + dz² ({r4(abs_dy**2 + abs_dz**2)}) exceeds TL² ({r4(known['true_length']**2)}).",
                )
            else:
                if set_or_check("dep", math.sqrt(max(0.0, dx_sq)), "mm", ["true_length"] + abs_dy_deps + abs_dz_deps, "sqrt(true_length^2 - dy^2 - dz^2)"):
                    changed = True

        if "front_view_length" in known and "alpha_fv" in known:
            fv = known["front_view_length"]
            al = known["alpha_fv"]
            if set_or_check("dep", fv * math.cos(deg2rad(al)), "mm", ["front_view_length", "alpha_fv"], "front_view_length * cos(alpha_fv)"):
                changed = True
            if set_or_check_abs_dz(fv * math.sin(deg2rad(al)), ["front_view_length", "alpha_fv"], "front_view_length * sin(alpha_fv)"):
                changed = True

        if "top_view_length" in known and "beta_tv" in known:
            tv = known["top_view_length"]
            be = known["beta_tv"]
            if set_or_check("dep", tv * math.cos(deg2rad(be)), "mm", ["top_view_length", "beta_tv"], "top_view_length * cos(beta_tv)"):
                changed = True
            if set_or_check_abs_dy(tv * math.sin(deg2rad(be)), ["top_view_length", "beta_tv"], "top_view_length * sin(beta_tv)"):
                changed = True

        if "dep" in known and abs_dz is not None:
            if known["dep"] > 1e-6 or abs_dz > 1e-6:
                al_val = rad2deg(math.atan2(abs_dz, known["dep"]))
                if set_or_check("alpha_fv", al_val, "deg", ["dep"] + abs_dz_deps, "atan2(|dz|, dep)"):
                    changed = True

        if "dep" in known and abs_dy is not None:
            if known["dep"] > 1e-6 or abs_dy > 1e-6:
                be_val = rad2deg(math.atan2(abs_dy, known["dep"]))
                if set_or_check("beta_tv", be_val, "deg", ["dep"] + abs_dy_deps, "atan2(|dy|, dep)"):
                    changed = True

        if "dep" in known and "alpha_fv" in known:
            cos_al = math.cos(deg2rad(known["alpha_fv"]))
            if cos_al > 1e-5:
                if set_or_check("front_view_length", known["dep"] / cos_al, "mm", ["dep", "alpha_fv"], "dep / cos(alpha_fv)"):
                    changed = True
                if set_or_check_abs_dz(known["dep"] * math.tan(deg2rad(known["alpha_fv"])), ["dep", "alpha_fv"], "dep * tan(alpha_fv)"):
                    changed = True

        if "dep" in known and "beta_tv" in known:
            cos_be = math.cos(deg2rad(known["beta_tv"]))
            if cos_be > 1e-5:
                if set_or_check("top_view_length", known["dep"] / cos_be, "mm", ["dep", "beta_tv"], "dep / cos(beta_tv)"):
                    changed = True
                if set_or_check_abs_dy(known["dep"] * math.tan(deg2rad(known["beta_tv"])), ["dep", "beta_tv"], "dep * tan(beta_tv)"):
                    changed = True

        if abs_dz is not None and "alpha_fv" in known:
            sin_al = math.sin(deg2rad(known["alpha_fv"]))
            if sin_al > 1e-5:
                if set_or_check("front_view_length", abs_dz / sin_al, "mm", abs_dz_deps + ["alpha_fv"], "|dz| / sin(alpha_fv)"):
                    changed = True

        if abs_dy is not None and "beta_tv" in known:
            sin_be = math.sin(deg2rad(known["beta_tv"]))
            if sin_be > 1e-5:
                if set_or_check("top_view_length", abs_dy / sin_be, "mm", abs_dy_deps + ["beta_tv"], "|dy| / sin(beta_tv)"):
                    changed = True

        if "front_view_length" in known and "top_view_length" in known and "dep" in known:
            tl_sq = known["front_view_length"] ** 2 + known["top_view_length"] ** 2 - known["dep"] ** 2
            if tl_sq < -TOL_MM:
                add_contradiction("INVALID_PROJECTION_TRIPLE", "true_length", "FV² + TV² cannot be smaller than DEP².")
            else:
                if set_or_check("true_length", math.sqrt(max(0.0, tl_sq)), "mm", ["front_view_length", "top_view_length", "dep"], "sqrt(FV^2 + TV^2 - dep^2)"):
                    changed = True

        if not changed or contradictions:
            break

    # Export abs_delta_z / abs_delta_y if resolved (even in underdetermined partial solves)
    if not contradictions:
        if abs_dz is not None:
            set_or_check("abs_delta_z", abs_dz, "mm", abs_dz_deps, abs_dz_formula)
        if abs_dy is not None:
            set_or_check("abs_delta_y", abs_dy, "mm", abs_dy_deps, abs_dy_formula)

    # Check zero true length if TL got derived to 0
    if "true_length" in known and known["true_length"] <= TOL_MM:
        add_contradiction("ZERO_TRUE_LENGTH", "true_length", f"Degenerate zero-length line (TL = {r4(known['true_length'])} mm).")

    # Resolve endpoint B signed positions from start_z_hp / start_y_vp + |dz| / |dy|
    if not contradictions:
        branch_pref = quadrant_hints.get("branch_preference", "unspecified")
        end_hp_hint = quadrant_hints.get("end_hp")
        end_vp_hint = quadrant_hints.get("end_vp")

        if "end_z_hp" not in known and "start_z_hp" in known and abs_dz is not None:
            z1 = known["start_z_hp"]
            if abs_dz <= TOL_MM:
                set_or_check("end_z_hp", z1, "mm", ["start_z_hp"] + abs_dz_deps, "start_z_hp + 0")
            else:
                z_plus = z1 + abs_dz
                z_minus = z1 - abs_dz
                if end_hp_hint == "below" and z_minus < 0 <= z_plus:
                    set_or_check("end_z_hp", z_minus, "mm", ["start_z_hp"] + abs_dz_deps, "start_z_hp - |dz| (end below HP)")
                elif end_hp_hint == "above" and z_minus < -TOL_MM:
                    set_or_check("end_z_hp", z_plus, "mm", ["start_z_hp"] + abs_dz_deps, "start_z_hp + |dz| (end above HP)")
                elif z_minus < -TOL_MM and (flags["first_quadrant"] or quadrant_hints.get("start_hp") in ("above", "on")):
                    set_or_check("end_z_hp", z_plus, "mm", ["start_z_hp"] + abs_dz_deps, "start_z_hp + |dz| (unique 1st-quadrant branch above HP)")
                elif branch_pref == "first_quadrant_positive":
                    set_or_check("end_z_hp", z_plus, "mm", ["start_z_hp"] + abs_dz_deps, "start_z_hp + |dz| (first-quadrant away from HP)")
                else:
                    ambiguities.append(
                        {
                            "id": "ambiguous_end_z_sign",
                            "property": "end_z_hp",
                            "reason": (
                                f"Both {end_lbl} = {r4(z_plus)} mm above HP (+|dz|) and "
                                f"{end_lbl} = {r4(z_minus)} mm above HP (-|dz|) satisfy |dz| = {r4(abs_dz)} mm. "
                                f"Specify whether {end_lbl} is higher or lower than {start_lbl}."
                            ),
                            "candidates": [
                                {"branch": "rising_away_from_hp", "end_z_hp": r4(z_plus), "dz": r4(abs_dz)},
                                {"branch": "falling_toward_hp", "end_z_hp": r4(z_minus), "dz": r4(-abs_dz)},
                            ],
                        }
                    )

        if "end_y_vp" not in known and "start_y_vp" in known and abs_dy is not None:
            y1 = known["start_y_vp"]
            if abs_dy <= TOL_MM:
                set_or_check("end_y_vp", y1, "mm", ["start_y_vp"] + abs_dy_deps, "start_y_vp + 0")
            else:
                y_plus = y1 + abs_dy
                y_minus = y1 - abs_dy
                if end_vp_hint == "behind" and y_minus < 0 <= y_plus:
                    set_or_check("end_y_vp", y_minus, "mm", ["start_y_vp"] + abs_dy_deps, "start_y_vp - |dy| (end behind VP)")
                elif end_vp_hint == "in_front" and y_minus < -TOL_MM:
                    set_or_check("end_y_vp", y_plus, "mm", ["start_y_vp"] + abs_dy_deps, "start_y_vp + |dy| (end in front of VP)")
                elif y_minus < -TOL_MM and (flags["first_quadrant"] or quadrant_hints.get("start_vp") in ("in_front", "on")):
                    set_or_check("end_y_vp", y_plus, "mm", ["start_y_vp"] + abs_dy_deps, "start_y_vp + |dy| (unique 1st-quadrant branch in front of VP)")
                elif branch_pref == "first_quadrant_positive":
                    set_or_check("end_y_vp", y_plus, "mm", ["start_y_vp"] + abs_dy_deps, "start_y_vp + |dy| (first-quadrant away from VP)")
                else:
                    ambiguities.append(
                        {
                            "id": "ambiguous_end_y_sign",
                            "property": "end_y_vp",
                            "reason": (
                                f"Both {end_lbl} = {r4(y_plus)} mm in front of VP (+|dy|) and "
                                f"{end_lbl} = {r4(y_minus)} mm in front of VP (-|dy|) satisfy |dy| = {r4(abs_dy)} mm. "
                                f"Specify whether {end_lbl} is farther from or nearer to VP than {start_lbl}."
                            ),
                            "candidates": [
                                {"branch": "away_from_vp", "end_y_vp": r4(y_plus), "dy": r4(abs_dy)},
                                {"branch": "toward_vp", "end_y_vp": r4(y_minus), "dy": r4(-abs_dy)},
                            ],
                        }
                    )

    required_for_draw = [
        "true_length",
        "front_view_length",
        "top_view_length",
        "dep",
        "theta_hp",
        "phi_vp",
        "start_z_hp",
        "start_y_vp",
        "end_z_hp",
        "end_y_vp",
    ]
    missing_required = [p for p in required_for_draw if p not in known]

    unresolved_unknowns: Dict[str, str] = {}
    for prop in (problem.get("unknowns") or {}).keys():
        if prop in known:
            continue
        if any(a.get("property") == prop for a in ambiguities):
            unresolved_unknowns[prop] = "Multiple valid geometric branches remain; direction or endpoint position must be specified."
        elif contradictions:
            unresolved_unknowns[prop] = "Cannot determine because input constraints are geometrically inconsistent."
        else:
            unresolved_unknowns[prop] = f"Underdetermined: insufficient independent constraints to uniquely compute '{prop}'."

    # Partial mathematical verification checks for derived values when underdetermined (e.g. FV + alpha -> dep, |dz|)
    if not contradictions and not ambiguities and missing_required:
        if "front_view_length" in known and "alpha_fv" in known and "dep" in known and abs_dz is not None:
            fv = known["front_view_length"]
            al = known["alpha_fv"]
            checks.append(
                {
                    "id": "check_partial_fv_right_triangle",
                    "name": "Partial Front-View Right Triangle (FV·cos α = DEP, FV·sin α = |Δz|)",
                    "passed": abs(fv * math.cos(deg2rad(al)) - known["dep"]) <= 1e-2
                    and abs(fv * math.sin(deg2rad(al)) - abs_dz) <= 1e-2,
                    "expected": f"DEP={r4(fv * math.cos(deg2rad(al)))}, |Δz|={r4(fv * math.sin(deg2rad(al)))}",
                    "actual": f"DEP={r4(known['dep'])}, |Δz|={r4(abs_dz)}",
                    "tolerance": 1e-2,
                }
            )
        if "top_view_length" in known and "beta_tv" in known and "dep" in known and abs_dy is not None:
            tv = known["top_view_length"]
            be = known["beta_tv"]
            checks.append(
                {
                    "id": "check_partial_tv_right_triangle",
                    "name": "Partial Top-View Right Triangle (TV·cos β = DEP, TV·sin β = |Δy|)",
                    "passed": abs(tv * math.cos(deg2rad(be)) - known["dep"]) <= 1e-2
                    and abs(tv * math.sin(deg2rad(be)) - abs_dy) <= 1e-2,
                    "expected": f"DEP={r4(tv * math.cos(deg2rad(be)))}, |Δy|={r4(tv * math.sin(deg2rad(be)))}",
                    "actual": f"DEP={r4(known['dep'])}, |Δy|={r4(abs_dy)}",
                    "tolerance": 1e-2,
                }
            )

    solved_coordinates = None
    if not contradictions and not ambiguities and not missing_required:
        tl = known["true_length"]
        fv = known["front_view_length"]
        tv = known["top_view_length"]
        dep = known["dep"]
        theta = known["theta_hp"]
        phi = known["phi_vp"]
        z1 = known["start_z_hp"]
        y1 = known["start_y_vp"]
        z2 = known["end_z_hp"]
        y2 = known["end_y_vp"]
        dz = z2 - z1
        dy = y2 - y1

        tl_check = math.sqrt(dep ** 2 + dy ** 2 + dz ** 2)
        fv_check = math.hypot(dep, dz)
        tv_check = math.hypot(dep, dy)
        sin2_sum = math.sin(deg2rad(theta)) ** 2 + math.sin(deg2rad(phi)) ** 2

        checks.extend(
            [
                {
                    "id": "check_3d_pythagoras",
                    "name": "3D Euclidean True Length Identity",
                    "passed": abs(tl_check - tl) <= 1e-2,
                    "expected": f"{r4(tl)} mm",
                    "actual": f"{r4(tl_check)} mm",
                    "tolerance": 1e-2,
                },
                {
                    "id": "check_fv_projection",
                    "name": "Front View Orthogonal Projection Identity",
                    "passed": abs(fv_check - fv) <= 1e-2 and abs(tl * math.cos(deg2rad(phi)) - fv) <= 1e-2,
                    "expected": f"{r4(fv)} mm",
                    "actual": f"{r4(fv_check)} mm",
                    "tolerance": 1e-2,
                },
                {
                    "id": "check_tv_projection",
                    "name": "Top View Orthogonal Projection Identity",
                    "passed": abs(tv_check - tv) <= 1e-2 and abs(tl * math.cos(deg2rad(theta)) - tv) <= 1e-2,
                    "expected": f"{r4(tv)} mm",
                    "actual": f"{r4(tv_check)} mm",
                    "tolerance": 1e-2,
                },
                {
                    "id": "check_direction_cosines",
                    "name": "Direction Cosines Spatial Bound (sin²θ + sin²φ ≤ 1)",
                    "passed": sin2_sum <= 1.0 + 1e-4,
                    "expected": "<= 1.0",
                    "actual": f"{sin2_sum:.4f}",
                    "tolerance": 1e-4,
                },
            ]
        )

        if not all(c["passed"] for c in checks):
            add_contradiction(
                "POST_SOLVE_IDENTITY_FAILED",
                None,
                "Solved values failed independent Euclidean/trigonometric consistency checks.",
            )
        else:
            s_low = start_lbl.lower()
            e_low = end_lbl.lower()
            b1_x = tl * math.cos(deg2rad(theta))
            b2_x = tl * math.cos(deg2rad(phi))

            solved_coordinates = {
                "xy_line_y": 0.0,
                "start_3d": {"x": 0.0, "y": r4(y1), "z": r4(z1)},
                "end_3d": {"x": r4(dep), "y": r4(y2), "z": r4(z2)},
                "front_view": {
                    "start": {"x": 0.0, "y": r4(z1), "label": f"{s_low}′"},
                    "end": {"x": r4(dep), "y": r4(z2), "label": f"{e_low}′"},
                },
                "top_view": {
                    "start": {"x": 0.0, "y": r4(-y1), "label": s_low},
                    "end": {"x": r4(dep), "y": r4(-y2), "label": e_low},
                },
                "auxiliary": {
                    "b1_prime": {"x": r4(b1_x), "y": r4(z2), "label": f"{e_low}₁′"},
                    "b2": {"x": r4(b2_x), "y": r4(-y2), "label": f"{e_low}₂"},
                },
            }

            checks.append(
                {
                    "id": "check_end_projector_alignment",
                    "name": "End Projector Alignment (x_FV == x_TV)",
                    "passed": abs(
                        solved_coordinates["front_view"]["end"]["x"]
                        - solved_coordinates["top_view"]["end"]["x"]
                    )
                    <= 1e-4,
                    "expected": f"{r4(dep)} mm",
                    "actual": f"{solved_coordinates['front_view']['end']['x']} mm == {solved_coordinates['top_view']['end']['x']} mm",
                    "tolerance": 1e-4,
                }
            )

    missing_requirements: List[Dict[str, Any]] = []
    if contradictions:
        solver_status = "inconsistent"
    elif ambiguities:
        solver_status = "ambiguous"
    elif missing_required:
        solver_status = "underdetermined"
        missing_requirements = diagnose_missing_constraints(
            known=known,
            abs_dz=abs_dz,
            abs_dy=abs_dy,
            flags=flags,
            start_lbl=start_lbl,
            end_lbl=end_lbl,
            missing_required=missing_required,
        )
        req_labels = [r["parameter"] for r in missing_requirements]
        contradictions.append(
            {
                "code": "UNDERDETERMINED_SYSTEM",
                "stage": "stage_3_python_solver",
                "severity": "warning",
                "field": req_labels[0] if req_labels else None,
                "message": (
                    f"Underdetermined geometry: provide missing requirement(s) [{', '.join(req_labels)}] "
                    f"to uniquely determine [{', '.join(missing_required)}]."
                ),
            }
        )
    else:
        solver_status = "solved"

    return {
        "ok": True,
        "solver_status": solver_status,
        "derived_values": derived_meta if solver_status != "inconsistent" else {},
        "unresolved_unknowns": unresolved_unknowns,
        "solved_coordinates": solved_coordinates if solver_status == "solved" else None,
        "solved_points": None,
        "missing_requirements": missing_requirements,
        "issues": contradictions,
        "ambiguities": ambiguities,
        "checks": checks,
        "derivation": derivation,
    }


def dispatch_solver(problem: Dict[str, Any]) -> Dict[str, Any]:
    module = problem.get("module") or {}
    module_id = module.get("id")
    impl_status = module.get("implementation_status")
    geometry = problem.get("geometry") or {}
    entity_type = geometry.get("entity_type")
    task_domain = (problem.get("task") or {}).get("domain")

    if module_id == "unknown_module" or task_domain == "unknown":
        return {
            "ok": True,
            "solver_status": "needs_clarification",
            "derived_values": {},
            "unresolved_unknowns": {},
            "solved_coordinates": None,
            "solved_points": None,
            "missing_requirements": [
                {
                    "id": "clarify_engineering_module",
                    "category": "module_support",
                    "parameter": "module.id",
                    "label": "Engineering Graphics Module & Entity",
                    "unit": None,
                    "alternatives": ["projection_of_points", "projection_of_straight_lines"],
                    "reason": "Input statement did not uniquely specify a known Engineering Graphics entity (e.g., Point or Straight Line).",
                    "example_fix": "Clarify the object and constraints (e.g., 'A point P is 25 mm above HP...' or 'A line AB 80 mm long...').",
                }
            ],
            "issues": [
                {
                    "code": "MODULE_NEEDS_CLARIFICATION",
                    "stage": "stage_3_python_solver",
                    "severity": "error",
                    "field": "module.id",
                    "message": "Cannot solve: problem module and geometric entities could not be identified without clarification.",
                }
            ],
            "ambiguities": [],
            "checks": [],
            "derivation": [],
        }

    if impl_status == "unsupported" or entity_type in ("plane", "solid", "general"):
        mod_name = module.get("name") or geometry.get("topic") or entity_type or "Unknown Module"
        return {
            "ok": True,
            "solver_status": "unsupported",
            "derived_values": {},
            "unresolved_unknowns": {},
            "solved_coordinates": None,
            "solved_points": None,
            "missing_requirements": [],
            "issues": [
                {
                    "code": "UNSUPPORTED_MODULE",
                    "stage": "stage_3_python_solver",
                    "severity": "error",
                    "field": "module.id",
                    "message": (
                        f"Module '{mod_name}' was accurately classified, but its deterministic domain solver "
                        "is not implemented in this release. No fabricated fallback geometry was generated."
                    ),
                }
            ],
            "ambiguities": [],
            "checks": [],
            "derivation": [],
        }

    if entity_type == "point_set" or module_id == "projection_of_points":
        return solve_point_set(problem)

    return solve_straight_line(problem)


def main() -> int:
    raw = sys.stdin.read()
    if not raw or not raw.strip():
        sys.stdout.write(
            json.dumps(
                {
                    "ok": False,
                    "solver_status": "error",
                    "missing_requirements": [],
                    "error": "Empty stdin payload sent to Python geometry solver.",
                }
            )
        )
        return 1

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        sys.stdout.write(
            json.dumps(
                {
                    "ok": False,
                    "solver_status": "error",
                    "missing_requirements": [],
                    "error": f"Malformed JSON input: {exc}",
                }
            )
        )
        return 1

    if not isinstance(payload, dict):
        sys.stdout.write(
            json.dumps(
                {
                    "ok": False,
                    "solver_status": "error",
                    "missing_requirements": [],
                    "error": "Input JSON root must be an object.",
                }
            )
        )
        return 1

    try:
        result = dispatch_solver(payload)
        sys.stdout.write(json.dumps(result))
        return 0
    except Exception as exc:
        sys.stdout.write(
            json.dumps(
                {
                    "ok": False,
                    "solver_status": "error",
                    "missing_requirements": [],
                    "error": f"Geometry solver exception: {exc}",
                }
            )
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
