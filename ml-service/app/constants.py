"""Locked constants from docs/API_CONTRACT.md §0."""

RULE_LABELS = {
    "bypassing_safety_controls": "Bypassing Safety Controls",
    "confined_space": "Confined Space",
    "driving": "Driving",
    "energy_isolation": "Energy Isolation",
    "hot_work": "Hot Work",
    "line_of_fire": "Line of Fire",
    "safe_mechanical_lifting": "Safe Mechanical Lifting",
    "work_authorisation": "Work Authorisation",
    "working_at_height": "Working at Height",
}
RULES = list(RULE_LABELS)

# Plain-language descriptions used for embedding similarity in rule tagging.
RULE_DESCRIPTIONS = {
    "bypassing_safety_controls": "bypassing, overriding or disabling safety controls, interlocks, trips, alarms or gas detectors",
    "confined_space": "entering a confined space such as a vessel, tank or pit with gas testing, standby person and entry permit",
    "driving": "driving vehicles, speeding, seat belts, mobile phone use while driving, reversing, journey management",
    "energy_isolation": "isolating energy before work, lockout tagout, electrical isolation, bleeding pressure, zero energy check",
    "hot_work": "hot work such as welding, grinding and gas cutting near flammable hydrocarbons, gas test and fire watch",
    "line_of_fire": "staying out of the line of fire of suspended loads, pressurised lines, dropped objects and moving equipment",
    "safe_mechanical_lifting": "safe mechanical lifting with cranes, slings, rigging, lift plans and certified riggers",
    "work_authorisation": "working with a valid work permit and authorisation before starting the job",
    "working_at_height": "working at height with fall protection, harness, guardrails, scaffolds and ladders",
}

BARRIERS = ["ppe", "procedure", "isolation", "supervision", "equipment", "training", "none"]
BARRIER_LABELS = {
    "ppe": "PPE", "procedure": "Procedure", "isolation": "Isolation", "supervision": "Supervision",
    "equipment": "Equipment", "training": "Training", "none": "None",
}
SEVERITIES = ["fatal", "serious", "minor"]
