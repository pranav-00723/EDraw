#!/usr/bin/env python3
"""Unit tests for Stage 3 Deterministic Python Geometry Solver."""

import math
import unittest

from geometry_solver import solve_straight_line


def make_problem(
    *,
    start="A",
    end="B",
    givens=None,
    constraints=None,
    uncertain_readings=None,
    branch_preference="unspecified",
):
    givens = givens or {}
    given_fields = {}
    for prop, (val, unit) in givens.items():
        given_fields[prop] = {
            "property": prop,
            "value": val,
            "unit": unit,
            "status": "given",
            "provenance": {
                "source_stage": "stage_2_parser",
                "excerpt": None,
                "dependencies": [],
                "formula": None,
                "reason": None,
            },
            "validation_status": "unvalidated",
        }

    all_props = [
        ("true_length", "mm"),
        ("front_view_length", "mm"),
        ("top_view_length", "mm"),
        ("dep", "mm"),
        ("theta_hp", "deg"),
        ("phi_vp", "deg"),
        ("alpha_fv", "deg"),
        ("beta_tv", "deg"),
        ("start_z_hp", "mm"),
        ("start_y_vp", "mm"),
        ("end_z_hp", "mm"),
        ("end_y_vp", "mm"),
    ]
    unknown_fields = {}
    for prop, unit in all_props:
        if prop not in given_fields:
            unknown_fields[prop] = {
                "property": prop,
                "value": None,
                "unit": unit,
                "status": "unknown",
                "provenance": {
                    "source_stage": "stage_2_parser",
                    "excerpt": None,
                    "dependencies": [],
                    "formula": None,
                    "reason": "Pending solver",
                },
                "validation_status": "unvalidated",
            }

    return {
        "schema_version": "1.0.0",
        "problem_id": "test_case_0001",
        "source": {
            "input_type": "text",
            "ocr_engine": "direct-text",
            "raw_text": "test",
            "normalized_text": "test",
            "confidence": 1.0,
            "warnings": [],
            "uncertain_readings": uncertain_readings or [],
        },
        "task": {
            "domain": "straight_line_projection",
            "projection_system": "first_angle",
            "requested_outputs": ["front_view", "top_view"],
            "description": "test",
        },
        "geometry": {
            "entity_type": "straight_line",
            "line_label": f"{start}{end}",
            "endpoints": {"start": start, "end": end},
            "planes": ["HP", "VP"],
            "quadrant_hints": {
                "start_hp": "above",
                "start_vp": "in_front",
                "end_hp": None,
                "end_vp": None,
                "branch_preference": branch_preference,
            },
            "solved_coordinates": None,
        },
        "givens": given_fields,
        "unknowns": unknown_fields,
        "constraints": constraints or [],
        "drawing_instructions": {
            "ready_to_render": False,
            "coordinate_system": "first_angle_bis_sp46",
            "scale": None,
            "views": ["front_view", "top_view"],
            "annotations": [],
            "blocked_reason": None,
        },
        "validation": {
            "schema_valid": True,
            "solver_status": "unsolved",
            "geometry_valid": False,
            "ready_for_render": False,
            "issues": [],
            "ambiguities": [],
            "checks": [],
        },
    }


class TestGeometrySolver(unittest.TestCase):
    def test_classic_fully_specified_ab(self):
        # TL=80, theta=30, phi=45, A=(20 above HP, 30 in front VP)
        problem = make_problem(
            start="A",
            end="B",
            givens={
                "true_length": (80.0, "mm"),
                "theta_hp": (30.0, "deg"),
                "phi_vp": (45.0, "deg"),
                "start_z_hp": (20.0, "mm"),
                "start_y_vp": (30.0, "mm"),
            },
        )
        res = solve_straight_line(problem)
        self.assertTrue(res["ok"])
        self.assertEqual(res["solver_status"], "solved")

        dv = res["derived_values"]
        self.assertAlmostEqual(dv["front_view_length"]["value"], 80.0 * math.cos(math.radians(45)), places=3)
        self.assertAlmostEqual(dv["top_view_length"]["value"], 80.0 * math.cos(math.radians(30)), places=3)
        self.assertAlmostEqual(dv["dep"]["value"], 40.0, places=3)
        self.assertAlmostEqual(dv["end_z_hp"]["value"], 60.0, places=3)
        self.assertAlmostEqual(dv["end_y_vp"]["value"], 30.0 + 80.0 * math.sin(math.radians(45)), places=3)
        self.assertAlmostEqual(dv["alpha_fv"]["value"], 45.0, places=2)
        self.assertAlmostEqual(
            dv["beta_tv"]["value"],
            math.degrees(math.atan2(80.0 * math.sin(math.radians(45)), 40.0)),
            places=2,
        )

        coords = res["solved_coordinates"]
        self.assertEqual(coords["front_view"]["start"]["label"], "a′")
        self.assertEqual(coords["front_view"]["end"]["label"], "b′")
        self.assertEqual(coords["top_view"]["start"]["label"], "a")
        self.assertEqual(coords["top_view"]["end"]["label"], "b")
        self.assertTrue(all(chk["passed"] for chk in res["checks"]))

    def test_derivable_unknowns_from_tl_fv_tv_for_nm(self):
        # Line NM: TL=75, FV=60, TV=55, N=(15 above HP, 20 in front VP)
        problem = make_problem(
            start="N",
            end="M",
            givens={
                "true_length": (75.0, "mm"),
                "front_view_length": (60.0, "mm"),
                "top_view_length": (55.0, "mm"),
                "start_z_hp": (15.0, "mm"),
                "start_y_vp": (20.0, "mm"),
            },
        )
        res = solve_straight_line(problem)
        self.assertEqual(res["solver_status"], "solved")

        expected_phi = math.degrees(math.acos(60.0 / 75.0))
        expected_theta = math.degrees(math.acos(55.0 / 75.0))
        expected_dz = 75.0 * math.sin(math.radians(expected_theta))
        expected_dy = 75.0 * math.sin(math.radians(expected_phi))
        expected_dep = math.sqrt(75.0**2 - expected_dz**2 - expected_dy**2)

        dv = res["derived_values"]
        self.assertAlmostEqual(dv["phi_vp"]["value"], expected_phi, places=2)
        self.assertAlmostEqual(dv["theta_hp"]["value"], expected_theta, places=2)
        self.assertAlmostEqual(dv["dep"]["value"], expected_dep, places=2)
        self.assertEqual(res["solved_coordinates"]["front_view"]["start"]["label"], "n′")
        self.assertEqual(res["solved_coordinates"]["front_view"]["end"]["label"], "m′")
        self.assertEqual(res["solved_coordinates"]["top_view"]["start"]["label"], "n")
        self.assertEqual(res["solved_coordinates"]["top_view"]["end"]["label"], "m")

    def test_parallel_hp_and_inclined_vp_for_jp(self):
        problem = make_problem(
            start="J",
            end="P",
            givens={
                "true_length": (65.0, "mm"),
                "phi_vp": (30.0, "deg"),
                "start_z_hp": (30.0, "mm"),
                "start_y_vp": (15.0, "mm"),
            },
            constraints=[
                {
                    "id": "c_par_hp",
                    "kind": "parallel_hp",
                    "target": "JP",
                    "relation": "parallel_to_HP",
                    "value": True,
                    "unit": None,
                    "status": "given",
                    "excerpt": "parallel to HP",
                }
            ],
        )
        res = solve_straight_line(problem)
        self.assertEqual(res["solver_status"], "solved")
        dv = res["derived_values"]
        self.assertAlmostEqual(dv["theta_hp"]["value"], 0.0, places=3)
        self.assertAlmostEqual(dv["end_z_hp"]["value"], 30.0, places=3)
        self.assertAlmostEqual(dv["end_y_vp"]["value"], 15.0 + 32.5, places=3)
        self.assertAlmostEqual(dv["top_view_length"]["value"], 65.0, places=3)
        self.assertAlmostEqual(dv["front_view_length"]["value"], 65.0 * math.cos(math.radians(30)), places=3)
        self.assertEqual(res["solved_coordinates"]["front_view"]["start"]["label"], "j′")
        self.assertEqual(res["solved_coordinates"]["front_view"]["end"]["label"], "p′")

    def test_contradictory_angle_sum_detected(self):
        problem = make_problem(
            givens={
                "true_length": (80.0, "mm"),
                "theta_hp": (60.0, "deg"),
                "phi_vp": (50.0, "deg"),
                "start_z_hp": (20.0, "mm"),
                "start_y_vp": (30.0, "mm"),
            }
        )
        res = solve_straight_line(problem)
        self.assertEqual(res["solver_status"], "inconsistent")
        self.assertIsNone(res["solved_coordinates"])
        codes = [i["code"] for i in res["issues"]]
        self.assertIn("ANGLE_SUM_EXCEEDS_90", codes)

    def test_contradictory_fv_exceeds_tl_detected(self):
        problem = make_problem(
            givens={
                "true_length": (80.0, "mm"),
                "front_view_length": (95.0, "mm"),
                "top_view_length": (60.0, "mm"),
                "start_z_hp": (20.0, "mm"),
                "start_y_vp": (30.0, "mm"),
            }
        )
        res = solve_straight_line(problem)
        self.assertEqual(res["solver_status"], "inconsistent")
        self.assertIsNone(res["solved_coordinates"])
        codes = [i["code"] for i in res["issues"]]
        self.assertIn("FV_EXCEEDS_TL", codes)

    def test_underdetermined_system_never_invents_values(self):
        problem = make_problem(
            givens={
                "true_length": (80.0, "mm"),
                "start_z_hp": (20.0, "mm"),
                "start_y_vp": (30.0, "mm"),
            }
        )
        res = solve_straight_line(problem)
        self.assertEqual(res["solver_status"], "underdetermined")
        self.assertIsNone(res["solved_coordinates"])
        self.assertIn("theta_hp", res["unresolved_unknowns"])
        self.assertIn("phi_vp", res["unresolved_unknowns"])

    def test_ambiguous_sign_branch_detected_when_both_stay_in_first_quadrant(self):
        # start_z_hp = 60, TL = 40, theta = 30 => |dz| = 20 => both 80 and 40 are > 0!
        problem = make_problem(
            givens={
                "true_length": (40.0, "mm"),
                "theta_hp": (30.0, "deg"),
                "phi_vp": (0.0, "deg"),
                "start_z_hp": (60.0, "mm"),
                "start_y_vp": (25.0, "mm"),
            }
        )
        res = solve_straight_line(problem)
        self.assertEqual(res["solver_status"], "ambiguous")
        self.assertIsNone(res["solved_coordinates"])
        self.assertGreaterEqual(len(res["ambiguities"]), 1)
        self.assertEqual(res["ambiguities"][0]["property"], "end_z_hp")

    def test_blocking_ocr_uncertainty_halts_solver(self):
        problem = make_problem(
            givens={
                "true_length": (80.0, "mm"),
                "phi_vp": (45.0, "deg"),
                "start_z_hp": (20.0, "mm"),
                "start_y_vp": (30.0, "mm"),
            },
            uncertain_readings=[
                {
                    "id": "ocr_angle_1",
                    "raw_token": "300 to HP",
                    "suspected_property": "theta_hp",
                    "reason": "Likely OCR degree-symbol misread",
                    "severity": "blocking",
                    "suggested_interpretation": "30° to HP",
                }
            ],
        )
        res = solve_straight_line(problem)
        self.assertEqual(res["solver_status"], "ambiguous")
        self.assertIsNone(res["solved_coordinates"])
        self.assertEqual(res["missing_requirements"], [])
        codes = [i["code"] for i in res["issues"]]
        self.assertIn("BLOCKING_OCR_UNCERTAINTY", codes)

    def test_missing_requirements_when_missing_tl_and_phi(self):
        # Preset p6: A=(20 above HP, 30 in front VP), theta=30 -> missing true_length + phi_vp
        problem = make_problem(
            start="A",
            end="B",
            givens={
                "start_z_hp": (20.0, "mm"),
                "start_y_vp": (30.0, "mm"),
                "theta_hp": (30.0, "deg"),
            },
        )
        res = solve_straight_line(problem)
        self.assertEqual(res["solver_status"], "underdetermined")
        reqs = res["missing_requirements"]
        params = [r["parameter"] for r in reqs]
        categories = {r["parameter"]: r["category"] for r in reqs}

        self.assertEqual(params, ["true_length", "phi_vp"])
        self.assertEqual(categories["true_length"], "length")
        self.assertEqual(categories["phi_vp"], "inclination")
        self.assertIn("front_view_length", reqs[0]["alternatives"])
        self.assertIn("end_y_vp", reqs[1]["alternatives"])

    def test_missing_requirements_when_only_true_length_given(self):
        # Only TL=80 given -> missing theta_hp, phi_vp, start_z_hp, start_y_vp
        problem = make_problem(
            start="A",
            end="B",
            givens={"true_length": (80.0, "mm")},
        )
        res = solve_straight_line(problem)
        self.assertEqual(res["solver_status"], "underdetermined")
        reqs = res["missing_requirements"]
        params = [r["parameter"] for r in reqs]
        categories = {r["parameter"]: r["category"] for r in reqs}

        self.assertEqual(params, ["theta_hp", "phi_vp", "start_z_hp", "start_y_vp"])
        self.assertEqual(categories["theta_hp"], "inclination")
        self.assertEqual(categories["phi_vp"], "inclination")
        self.assertEqual(categories["start_z_hp"], "position")
        self.assertEqual(categories["start_y_vp"], "position")

    def test_missing_requirements_when_both_endpoints_hp_vp_known_needs_dep_coupling(self):
        # A=(15, 20), B=(55, 65) => |dz|=40, |dy|=45 known, only 1 horizontal coupling DOF (DEP/TL/angle) needed
        problem = make_problem(
            start="A",
            end="B",
            givens={
                "start_z_hp": (15.0, "mm"),
                "start_y_vp": (20.0, "mm"),
                "end_z_hp": (55.0, "mm"),
                "end_y_vp": (65.0, "mm"),
            },
        )
        res = solve_straight_line(problem)
        self.assertEqual(res["solver_status"], "underdetermined")
        reqs = res["missing_requirements"]
        self.assertEqual(len(reqs), 1)
        self.assertEqual(reqs[0]["parameter"], "dep")
        self.assertEqual(reqs[0]["category"], "distance")
        self.assertIn("true_length", reqs[0]["alternatives"])
        self.assertIn("theta_hp", reqs[0]["alternatives"])

    def test_missing_requirements_when_shape_known_without_endpoint_positions(self):
        # TL=80, theta=30, phi=45 without endpoint HP/VP distances -> needs start_z_hp & start_y_vp
        problem = make_problem(
            start="P",
            end="Q",
            givens={
                "true_length": (80.0, "mm"),
                "theta_hp": (30.0, "deg"),
                "phi_vp": (45.0, "deg"),
            },
        )
        res = solve_straight_line(problem)
        self.assertEqual(res["solver_status"], "underdetermined")
        reqs = res["missing_requirements"]
        params = [r["parameter"] for r in reqs]
        self.assertEqual(params, ["start_z_hp", "start_y_vp"])
        self.assertTrue(all(r["category"] == "position" for r in reqs))

    def test_missing_requirements_empty_when_solved_or_inconsistent(self):
        solved_problem = make_problem(
            givens={
                "true_length": (80.0, "mm"),
                "theta_hp": (30.0, "deg"),
                "phi_vp": (45.0, "deg"),
                "start_z_hp": (20.0, "mm"),
                "start_y_vp": (30.0, "mm"),
            }
        )
        solved_res = solve_straight_line(solved_problem)
        self.assertEqual(solved_res["solver_status"], "solved")
        self.assertEqual(solved_res["missing_requirements"], [])

        inconsistent_problem = make_problem(
            givens={
                "true_length": (80.0, "mm"),
                "theta_hp": (60.0, "deg"),
                "phi_vp": (50.0, "deg"),
                "start_z_hp": (20.0, "mm"),
                "start_y_vp": (30.0, "mm"),
            }
        )
        inconsistent_res = solve_straight_line(inconsistent_problem)
        self.assertEqual(inconsistent_res["solver_status"], "inconsistent")
        self.assertEqual(inconsistent_res["missing_requirements"], [])


if __name__ == "__main__":
    unittest.main()
