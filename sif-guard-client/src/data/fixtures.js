// Realistic mock/fixture data — mirrors the Report/Site schema in the build
// spec exactly, so swapping in live Mongo + FastAPI responses later is a
// drop-in replacement for these arrays, not a rewrite.

export const SITES = [
  { id: "duliajan", name: "Duliajan Field", region: "Assam" },
  { id: "moran", name: "Moran Field", region: "Assam" },
  { id: "naharkatiya", name: "Naharkatiya", region: "Assam" },
  { id: "baghjan", name: "Baghjan", region: "Assam" },
  { id: "jaisalmer", name: "Jaisalmer Block", region: "Rajasthan" },
];

export const REPORTS = [
  {
    id: "R-1042",
    rawText:
      "Contractor entered confined vessel for cleaning without isolating the inlet line. PPE was worn but the isolation permit had not been signed off by the shift supervisor before entry began.",
    site: "duliajan",
    activity: "Confined Space Entry",
    reportedBy: "K. Baruah",
    reportDate: "2026-08-14",
    isSifPotential: true,
    confidenceScore: 0.87,
    highlightedPhrases: ["without isolating the inlet line", "isolation permit had not been signed off"],
    lifeSavingRuleTags: ["Energy Isolation", "Confined Space"],
    barrierFailureType: "Procedure",
  },
  {
    id: "R-1043",
    rawText:
      "During hot work near the separator, a fire watch was not posted. Welder noticed hydrocarbon smell and stopped work independently before any ignition source was introduced.",
    site: "moran",
    activity: "Hot Work",
    reportedBy: "A. Sharma",
    reportDate: "2026-08-15",
    isSifPotential: true,
    confidenceScore: 0.79,
    highlightedPhrases: ["fire watch was not posted", "hydrocarbon smell"],
    lifeSavingRuleTags: ["Hot Work", "Line of Fire"],
    barrierFailureType: "Supervision",
  },
  {
    id: "R-1044",
    rawText:
      "Housekeeping observation — cable tray cover missing near the admin block walkway. Flagged to maintenance for replacement, no injury or near-miss involved.",
    site: "duliajan",
    activity: "General Housekeeping",
    reportedBy: "R. Gogoi",
    reportDate: "2026-08-15",
    isSifPotential: false,
    confidenceScore: 0.12,
    highlightedPhrases: [],
    lifeSavingRuleTags: [],
    barrierFailureType: "",
  },
  {
    id: "R-1045",
    rawText:
      "Rigger positioned under a suspended load while adjusting a tag line during a crane lift. Crew was verbally warned; no barricade was in place to prevent standing beneath the load.",
    site: "baghjan",
    activity: "Lifting Operation",
    reportedBy: "S. Deka",
    reportDate: "2026-08-16",
    isSifPotential: true,
    confidenceScore: 0.91,
    highlightedPhrases: ["positioned under a suspended load", "no barricade was in place"],
    lifeSavingRuleTags: ["Line of Fire", "Safe Mechanical Lifting"],
    barrierFailureType: "PPE",
  },
  {
    id: "R-1046",
    rawText:
      "Near-miss during vehicle reversing in the yard — reverse alarm was functioning and ground guide was present. Driver stopped promptly when a worker crossed the path.",
    site: "jaisalmer",
    activity: "Vehicle Movement",
    reportedBy: "V. Singh",
    reportDate: "2026-08-16",
    isSifPotential: false,
    confidenceScore: 0.24,
    highlightedPhrases: [],
    lifeSavingRuleTags: ["Driving"],
    barrierFailureType: "",
  },
  {
    id: "R-1047",
    rawText:
      "Technician bypassed the interlock on the pressure relief system to continue testing after the shift deadline, intending to re-engage it before handover. Handover log had no entry of the bypass.",
    site: "moran",
    activity: "Pressure Testing",
    reportedBy: "A. Sharma",
    reportDate: "2026-08-17",
    isSifPotential: true,
    confidenceScore: 0.94,
    highlightedPhrases: ["bypassed the interlock", "handover log had no entry of the bypass"],
    lifeSavingRuleTags: ["Energy Isolation", "Safe Mechanical Lifting"],
    barrierFailureType: "Isolation",
  },
  {
    id: "R-1048",
    rawText:
      "Scaffold inspection tag was expired by six days but work continued at height. Harness was worn and correctly anchored throughout the shift.",
    site: "naharkatiya",
    activity: "Work at Height",
    reportedBy: "P. Chetia",
    reportDate: "2026-08-17",
    isSifPotential: true,
    confidenceScore: 0.68,
    highlightedPhrases: ["inspection tag was expired", "work continued at height"],
    lifeSavingRuleTags: ["Working at Height"],
    barrierFailureType: "Procedure",
  },
  {
    id: "R-1049",
    rawText:
      "Spill of approximately two litres of hydraulic fluid during routine top-up, contained immediately with absorbent pads. No slip hazard resulted.",
    site: "duliajan",
    activity: "Maintenance",
    reportedBy: "K. Baruah",
    reportDate: "2026-08-18",
    isSifPotential: false,
    confidenceScore: 0.08,
    highlightedPhrases: [],
    lifeSavingRuleTags: [],
    barrierFailureType: "",
  },
  {
    id: "R-1050",
    rawText:
      "Second confined space entry this month at the same vessel without isolation sign-off — crew stated the permit process is 'too slow' during shutdown windows.",
    site: "duliajan",
    activity: "Confined Space Entry",
    reportedBy: "R. Gogoi",
    reportDate: "2026-08-19",
    isSifPotential: true,
    confidenceScore: 0.89,
    highlightedPhrases: ["without isolation sign-off", "permit process is 'too slow'"],
    lifeSavingRuleTags: ["Energy Isolation", "Confined Space"],
    barrierFailureType: "Procedure",
  },
  {
    id: "R-1051",
    rawText:
      "Crane operator proceeded with a lift while wind speed was above the posted limit for the load chart in use. Lift was halted midway by the site supervisor.",
    site: "baghjan",
    activity: "Lifting Operation",
    reportedBy: "S. Deka",
    reportDate: "2026-08-19",
    isSifPotential: true,
    confidenceScore: 0.82,
    highlightedPhrases: ["wind speed was above the posted limit"],
    lifeSavingRuleTags: ["Safe Mechanical Lifting"],
    barrierFailureType: "Supervision",
  },
  {
    id: "R-1052",
    rawText:
      "Fire extinguisher found discharged and not replaced near the mud pump skid, discovered during weekly audit rather than reported at time of use.",
    site: "jaisalmer",
    activity: "Equipment Audit",
    reportedBy: "V. Singh",
    reportDate: "2026-08-20",
    isSifPotential: false,
    confidenceScore: 0.31,
    highlightedPhrases: [],
    lifeSavingRuleTags: [],
    barrierFailureType: "",
  },
  {
    id: "R-1053",
    rawText:
      "Worker removed a machine guard to clear a jam without locking out the equipment, citing time pressure to restart the line. Guard was reinstalled after the fact.",
    site: "naharkatiya",
    activity: "Mechanical Maintenance",
    reportedBy: "P. Chetia",
    reportDate: "2026-08-21",
    isSifPotential: true,
    confidenceScore: 0.9,
    highlightedPhrases: ["removed a machine guard", "without locking out the equipment"],
    lifeSavingRuleTags: ["Energy Isolation"],
    barrierFailureType: "PPE",
  },
];

export const CURRENT_USER = {
  name: "K. Baruah",
  role: "hse_officer", // "hse_officer" | "site_supervisor" | "admin"
  site: null,
};
