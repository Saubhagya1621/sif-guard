"""Synthetic labelled dataset for oil & gas field safety reports.

Labelling principle (DEKRA / EEI SIF methodology): a report is SIF-potential when a high-energy source
(live electrical/mechanical energy, suspended load, height, hydrocarbons + ignition, toxic atmosphere,
pressure, moving vehicle) meets an absent or failed control, regardless of actual outcome. So
"walked under a suspended load, nobody hurt" = SIF, while "cut finger on a carton, first aid" = NON_SIF.

Each family has SIF templates and NON_SIF hard negatives in the same activity. Templates listed under
held_* are never used for training; they form the validation set (data/validation.csv), so validation
measures generalisation to new phrasings, not memorised templates."""
import csv
import random
import re
from pathlib import Path


def F(text, barrier="none", sev="minor", rules=None, act=None):
    return (text, barrier, sev, rules, act)


WORKERS = ["fitter", "helper", "rigger", "operator", "contractor worker", "electrician", "welder", "roustabout",
           "derrickman", "technician", "pumpman", "crew member", "trainee", "shift engineer"]
LOCATIONS = ["Well pad 3", "Well pad 7", "Well pad 11", "GGS-2", "GGS-4", "OCS-1", "Rig DJN-12", "Rig MRN-5",
             "Tank farm", "Pump house", "Compressor station", "Workshop", "EPS Baghjan", "Field road", "Jaisalmer camp"]

FAMILIES = [
    {
        "activity": "Pump maintenance", "rules": ["energy_isolation"],
        "x": ["centrifugal pump", "transfer pump", "crude oil pump", "water injection pump", "booster pump"],
        "sif": [
            F("{worker} opened the {x} casing without lockout while the motor was still energised", "isolation", "fatal"),
            F("{worker} started work on the {x} before isolation was verified; the breaker was not locked", "isolation", "fatal"),
            F("LOTO not applied on the {x}; {worker} had hands inside the coupling guard when the motor bumped", "isolation", "fatal"),
            F("New {worker} changed the {x} impeller alone without isolation training or supervision", "training", "fatal"),
        ],
        "safe": [
            F("{worker} replaced the {x} seal after lockout was applied and zero energy was verified"),
            F("Minor oil drip observed from the {x} gland, maintenance request raised", "equipment"),
            F("{worker} did not return the isolation key to the key box after the job was closed", "procedure"),
        ],
        "held_sif": [F("Found {worker} replacing the {x} coupling with the MCC still live and no isolation tag", "isolation", "fatal")],
        "held_safe": [F("Isolation certificate for the {x} was filled late but the lock was in place throughout", "procedure")],
    },
    {
        "activity": "Crane lift", "rules": ["safe_mechanical_lifting"],
        "x": ["drill pipe bundle", "casing joints", "BOP stack", "mud pump module", "pipe basket", "generator skid"],
        "sif": [
            F("{worker} walked under the suspended load during crane lift of the {x}", "supervision", "fatal", ["safe_mechanical_lifting", "line_of_fire"]),
            F("Frayed sling used to lift the {x}; the load swung close to the crew", "equipment", "fatal"),
            F("Crane lifted the {x} without a certified rigger and no tagline, load passed over people", "procedure", "fatal", ["safe_mechanical_lifting", "line_of_fire"]),
            F("Trainee operated the crane to lift the {x} without training certificate or supervision", "training", "fatal"),
        ],
        "safe": [
            F("Lift plan for the {x} reviewed and area barricaded before crane operation"),
            F("Crane operator logbook not updated this week, no lifting in progress", "procedure"),
            F("Tagline found stored in the wrong place during housekeeping round", "procedure"),
        ],
        "held_sif": [F("The {x} slipped from the shackle during lifting and dropped a metre from {worker}", "equipment", "fatal", ["safe_mechanical_lifting", "line_of_fire"])],
        "held_safe": [F("Colour code on two unused slings had expired; slings removed from service", "equipment")],
    },
    {
        "activity": "Hot work", "rules": ["hot_work"],
        "x": ["crude oil tank", "condensate tank", "separator", "flare line", "heater treater"],
        "sif": [
            F("Welding started near the {x} without hot work permit and no gas test", "procedure", "fatal", ["hot_work", "work_authorisation"]),
            F("Grinding sparks falling on an oily area near the {x}; fire watch was not present", "supervision", "fatal"),
            F("Gas cutting done on the {x} line that was not purged, hydrocarbon smell reported", "isolation", "fatal", ["hot_work", "energy_isolation"]),
        ],
        "safe": [
            F("Hot work permit displayed, gas test done and extinguisher kept ready before welding near the {x}"),
            F("Welding screen in the workshop was torn and has been replaced", "equipment", act="Workshop"),
            F("{worker} got a small burn on the glove from welding spatter, first aid given", "ppe"),
        ],
        "held_sif": [F("{worker} continued hot work on the {x} inside the hazardous zone after the permit had expired", "procedure", "fatal", ["hot_work", "work_authorisation"])],
        "held_safe": [F("Fire watch log sheet not signed at end of shift; hot work on the {x} had been completed safely", "procedure")],
    },
    {
        "activity": "Confined space entry", "rules": ["confined_space"],
        "x": ["separator vessel", "sludge tank", "mud tank", "knockout drum", "water storage tank"],
        "sif": [
            F("{worker} entered the {x} before atmospheric testing was done", "procedure", "fatal"),
            F("Standby man was not present at the manhole while {worker} was inside the {x}", "supervision", "fatal"),
            F("H2S alarm sounded inside the {x}; entry had been made without a personal gas detector", "ppe", "fatal"),
            F("Untrained helper was sent alone into the {x} to remove sludge", "training", "fatal"),
        ],
        "safe": [
            F("Entry into the {x} done with permit, gas test and standby man as per procedure"),
            F("Confined space warning sign on the {x} has faded and was replaced"),
            F("Gas detector calibration for the {x} job is due next week", "equipment"),
        ],
        "held_sif": [F("Contractor worked inside the {x} with no confined space permit and the ventilation fan switched off", "procedure", "fatal", ["confined_space", "work_authorisation"])],
        "held_safe": [F("Entry log for the {x} had a missing exit time; all workers were accounted for", "procedure")],
    },
    {
        "activity": "Work at height", "rules": ["working_at_height"],
        "x": ["monkey board", "derrick", "scaffold", "tank roof", "pipe rack"],
        "sif": [
            F("{worker} working on the {x} without harness anchored", "ppe", "fatal"),
            F("Scaffold near the {x} had a missing guardrail and toe board while {worker} worked at the edge", "equipment", "fatal"),
            F("{worker} climbed to the {x} carrying tools with no fall protection", "ppe", "serious"),
        ],
        "safe": [
            F("{worker} worked on the {x} with harness clipped to the anchor point and the area below barricaded"),
            F("Inspection tag missing on a spare harness kept in the store", "equipment"),
            F("{worker} slipped on the bottom step of the ladder, no injury"),
        ],
        "held_sif": [F("Spanner dropped from the {x} and landed next to crew working below", "procedure", "fatal", ["working_at_height", "line_of_fire"])],
        "held_safe": [F("Scaffold tag near the {x} not updated after daily inspection; scaffold found in good condition", "procedure")],
    },
    {
        "activity": "Vehicle movement", "rules": ["driving"],
        "x": ["tanker", "pickup", "crane truck", "trailer", "crew bus"],
        "sif": [
            F("The {x} driver was overspeeding on the field road and nearly hit a pedestrian", "procedure", "fatal"),
            F("The {x} reversed on the well pad without a banksman and missed {worker} by a metre", "supervision", "fatal", ["driving", "line_of_fire"]),
            F("Driver of the {x} was using a mobile phone while driving through the plant", "procedure", "serious"),
        ],
        "safe": [
            F("The {x} was parked in the designated area with wheel chocks applied"),
            F("Journey management form for the {x} was filled after the trip instead of before", "procedure"),
            F("Minor scratch on the {x} bumper while parking at camp, nobody nearby"),
        ],
        "held_sif": [F("The {x} was driven at night on the field road with no headlights working", "equipment", "fatal")],
        "held_safe": [F("Seat belt reminder of the {x} not working, reported to the transport section", "equipment")],
    },
    {
        "activity": "Process operation", "rules": ["bypassing_safety_controls"],
        "x": ["compressor", "heater treater", "gas separator", "water injection pump", "ESP panel"],
        "sif": [
            F("Operator bypassed the high-pressure trip interlock on the {x} to avoid nuisance shutdowns", "procedure", "fatal"),
            F("Gas detector at the {x} was inhibited for two days without authorisation", "procedure", "fatal", ["bypassing_safety_controls", "work_authorisation"]),
            F("Emergency shutdown switch on the {x} was found jumpered out", "equipment", "fatal"),
        ],
        "safe": [
            F("Trip interlock on the {x} tested as per schedule and found working"),
            F("Override register for the {x} not updated; no override was active", "procedure"),
        ],
        "held_sif": [F("Relief valve isolation on the {x} found closed during normal operation", "isolation", "fatal", ["bypassing_safety_controls", "energy_isolation"])],
        "held_safe": [F("Alarm on the {x} panel acknowledged late by the operator; process remained stable", "supervision")],
    },
    {
        "activity": "Well testing", "rules": ["line_of_fire"],
        "x": ["flowline", "test separator", "choke manifold", "high-pressure hose", "wellhead"],
        "sif": [
            F("Hose whipped when the union on the {x} was opened without bleeding the line; crew standing in line of fire", "isolation", "fatal", ["line_of_fire", "energy_isolation"]),
            F("{worker} stood in front of the {x} while it was being pressurised", "supervision", "fatal"),
            F("Hammer union on the {x} was tightened while under pressure", "procedure", "fatal"),
        ],
        "safe": [
            F("Pressure test of the {x} done with the exclusion zone barricaded"),
            F("Whip check missing on an idle hose in the store yard", "equipment"),
        ],
        "held_sif": [F("Pipe rolled off the rack near the {x} and pinned {worker}'s leg against the catwalk", "equipment", "serious")],
        "held_safe": [F("Bleed-off line of the {x} was not labelled; the line was already depressurised", "procedure")],
    },
    {
        "activity": "Electrical work", "rules": ["work_authorisation"],
        "x": ["MCC panel", "distribution board", "ESP panel", "lighting panel", "control panel"],
        "sif": [
            F("{worker} started electrical work on the {x} without a permit or isolation", "procedure", "fatal", ["work_authorisation", "energy_isolation"]),
            F("Excavation near a live gas pipeline started without a work permit", "procedure", "fatal", act="Excavation"),
            F("Contractor crew continued work on the {x} after the permit was cancelled due to a gas alarm", "supervision", "fatal"),
        ],
        "safe": [
            F("Permit to work for the {x} job signed and displayed at the site"),
            F("Permit copy for the {x} job found in the wrong file during audit; job already closed", "procedure"),
        ],
        "held_sif": [F("{worker} energised the {x} while another crew still held the permit on it", "procedure", "fatal", ["work_authorisation", "energy_isolation"])],
        "held_safe": [F("Permit receiver's signature was faint; permit otherwise complete", "procedure")],
    },
]

GENERAL = {
    "activity": "General operations", "rules": [],
    "safe": [
        F("Housekeeping poor near {loc}, oily rags lying on the floor", act="Housekeeping"),
        F("{worker} slipped on a wet floor in the canteen, no injury", act="General movement"),
        F("{worker} not wearing safety goggles while cleaning the office area", "ppe", act="Housekeeping"),
        F("First aid box at {loc} missing bandages, refilled", "equipment"),
        F("{worker} cut a finger on the sharp edge of a carton, first aid given", "ppe"),
        F("Exit signage at {loc} not illuminated", "equipment"),
        F("Drinking water cooler leaking in the rest room", "equipment"),
        F("Trainee not aware of the muster point during induction", "training"),
        F("Minor bruise to {worker}'s hand while opening a stuck drawer"),
    ],
    "held_safe": [
        F("Dustbin overflowing near the control room entrance", act="Housekeeping"),
        F("{worker} complained of mild headache due to heat, rested and returned to work"),
        F("Notice board at {loc} has outdated emergency contact numbers", "procedure"),
    ],
}

PREFIXES = ["", "", "", "During the night shift, ", "During routine inspection it was observed that ", "Observation: ",
            "At {loc}, ", "Near miss reported: "]
SUFFIXES = ["", "", " Job was stopped and the crew was counselled.", " Area in-charge informed.",
            " Corrective action raised in the HSSE portal.", " Reported by the shift supervisor.", " Nobody was hurt."]
ABBREVIATIONS = [("without", "w/o"), ("lockout", "LOTO"), ("permit to work", "PTW"), ("supervisor", "supvr"),
                 ("operator", "optr")]
# Paraphrase variation so the model learns concepts rather than template wording.
SYNONYMS = [
    ("walked under", ["stood under", "was standing under", "passed under"]),
    ("without", ["with no", "without any"]),
    ("was not present", ["was absent", "was not available"]),
    ("started", ["began", "commenced"]),
    ("nearly hit", ["almost hit", "narrowly missed"]),
    ("found", ["observed", "noticed"]),
    ("crew", ["team", "workers"]),
    ("done", ["carried out", "performed"]),
    ("near", ["close to", "next to"]),
    ("reported", ["logged"]),
]


def _synonyms(text, rng):
    for word, options in SYNONYMS:
        if rng.random() < 0.35:
            text = re.sub(rf"\b{re.escape(word)}\b", rng.choice(options), text)
    return text


FIELDS = ["text", "classification", "potential_severity", "rules", "barrier_failure_type", "activity", "location"]


def _fill(tpl, fam, rng, sif):
    text, barrier, sev, rules, act = tpl
    loc = rng.choice(LOCATIONS)
    body = text.format(worker=rng.choice(WORKERS), x=rng.choice(fam.get("x") or [""]), loc=loc)
    return {
        "text": body[0].upper() + body[1:], "classification": "SIF" if sif else "NON_SIF",
        "potential_severity": sev, "rules": list(rules if rules is not None else fam["rules"]),
        "barrier_failure_type": barrier, "activity": act or fam["activity"], "location": loc,
    }


def _typo(word, rng):
    i = rng.randrange(1, len(word) - 1)
    op = rng.choice("dsr")
    if op == "d":
        return word[:i] + word[i + 1:]
    if op == "s":
        return word[:i] + word[i + 1] + word[i] + word[i + 2:]
    return word[:i] + word[i] + word[i:]


def _augment(row, rng, noise):
    t = _synonyms(row["text"], rng)
    pre = rng.choice(PREFIXES).format(loc=row["location"])
    if pre and len(t) > 1 and t[1].islower():
        t = t[0].lower() + t[1:]
    t = pre + t
    if not t.endswith("."):
        t += "."
    t += rng.choice(SUFFIXES)
    if rng.random() < noise:
        for a, b in ABBREVIATIONS:
            if a in t and rng.random() < 0.6:
                t = t.replace(a, b)
        if rng.random() < 0.3:
            t = t.lower()
        if rng.random() < 0.4:
            words = t.split(" ")
            cands = [k for k, w in enumerate(words) if len(w) > 4 and w.isalpha()]
            for k in rng.sample(cands, min(len(cands), rng.randint(1, 2))):
                words[k] = _typo(words[k], rng)
            t = " ".join(words)
        if rng.random() < 0.2:
            t = re.sub(r"[.;,]", "", t)
    return {**row, "text": t.strip()}


def _write(path, rows):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for r in rows:
            w.writerow({**r, "rules": "|".join(r["rules"])})


def generate(out_dir, seed=42, total=1600, sif_rate=0.22):
    rng = random.Random(seed)
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    n_sif = round(total * sif_rate)
    train, seen = [], set()

    def add(row):
        key = row["text"].lower()
        if key in seen:
            return False
        seen.add(key)
        train.append(row)
        return True

    sif_count = tries = 0
    while sif_count < n_sif and tries < 30 * total:
        tries += 1
        fam = rng.choice(FAMILIES)
        sif_count += add(_augment(_fill(rng.choice(fam["sif"]), fam, rng, True), rng, 0.5))
    safe_count = 0
    while safe_count < total - n_sif and tries < 60 * total:
        tries += 1
        fam = GENERAL if rng.random() < 0.45 else rng.choice(FAMILIES)
        safe_count += add(_augment(_fill(rng.choice(fam["safe"]), fam, rng, False), rng, 0.5))
    rng.shuffle(train)

    vrng = random.Random(seed + 1)
    val = []
    for fam in FAMILIES:
        for tpl in fam["held_sif"]:
            val += [_augment(_fill(tpl, fam, vrng, True), vrng, 0.3) for _ in range(4)]
        for tpl in fam["held_safe"]:
            val += [_augment(_fill(tpl, fam, vrng, False), vrng, 0.3) for _ in range(6)]
    for tpl in GENERAL["held_safe"]:
        val += [_augment(_fill(tpl, GENERAL, vrng, False), vrng, 0.3) for _ in range(8)]

    _write(out_dir / "train.csv", train)
    _write(out_dir / "validation.csv", val)
    return {"train": len(train), "train_sif": sif_count, "validation": len(val),
            "validation_sif": sum(r["classification"] == "SIF" for r in val)}
