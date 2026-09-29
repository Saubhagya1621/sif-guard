// Locked constants from docs/API_CONTRACT.md §0: identical strings on client, server and ML service.
export const SITES = [
  { id: "duliajan", name: "Duliajan Field", region: "Assam" },
  { id: "moran", name: "Moran Field", region: "Assam" },
  { id: "naharkatiya", name: "Naharkatiya", region: "Assam" },
  { id: "baghjan", name: "Baghjan", region: "Assam" },
  { id: "jaisalmer", name: "Jaisalmer Block", region: "Rajasthan" },
];
export const SITE_NAME = Object.fromEntries(SITES.map((s) => [s.id, s.name]));

export const RULE_LABELS = {
  bypassing_safety_controls: "Bypassing Safety Controls",
  confined_space: "Confined Space",
  driving: "Driving",
  energy_isolation: "Energy Isolation",
  hot_work: "Hot Work",
  line_of_fire: "Line of Fire",
  safe_mechanical_lifting: "Safe Mechanical Lifting",
  work_authorisation: "Work Authorisation",
  working_at_height: "Working at Height",
};
export const RULES = Object.keys(RULE_LABELS);

export const BARRIER_LABELS = {
  ppe: "PPE", procedure: "Procedure", isolation: "Isolation", supervision: "Supervision",
  equipment: "Equipment", training: "Training", none: "None",
};
export const BARRIERS = Object.keys(BARRIER_LABELS);

export const SEVERITY_LABELS = { fatal: "Fatal potential", serious: "Serious potential", minor: "Minor" };
export const REPORT_TYPE_LABELS = { UA: "Unsafe act", UC: "Unsafe condition", near_miss: "Near miss", incident: "Incident" };
export const ROLE_LABELS = { admin: "Admin", hse_officer: "HSE Officer", site_supervisor: "Site Supervisor" };
export const ROLES = Object.keys(ROLE_LABELS);

export const DEMO_CREDENTIALS = [
  { email: "admin@sifguard.dev", password: "Admin@123", role: "admin" },
  { email: "hse@sifguard.dev", password: "Hse@1234", role: "hse_officer" },
  { email: "manager@sifguard.dev", password: "Manager@123", role: "site_supervisor" },
];

export const canReview = (user) => user?.role === "admin" || user?.role === "hse_officer";
export const ruleLabel = (k) => RULE_LABELS[k] || k || "—";
export const barrierLabel = (k) => BARRIER_LABELS[k] || k || "—";
