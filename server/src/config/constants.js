// Locked constants from docs/API_CONTRACT.md §0 — change only after team agreement.
const ROLES = ['admin', 'hse_officer', 'site_supervisor'];

const SITES = [
  { id: 'duliajan', name: 'Duliajan Field' },
  { id: 'moran', name: 'Moran Field' },
  { id: 'naharkatiya', name: 'Naharkatiya' },
  { id: 'baghjan', name: 'Baghjan' },
  { id: 'jaisalmer', name: 'Jaisalmer Block' },
];
const SITE_IDS = SITES.map((s) => s.id);
const SITE_NAME = Object.fromEntries(SITES.map((s) => [s.id, s.name]));

const REPORT_TYPES = ['UA', 'UC', 'near_miss', 'incident'];
const REPORT_TYPE_LABELS = { UA: 'Unsafe act', UC: 'Unsafe condition', near_miss: 'Near miss', incident: 'Incident' };
const CLASSIFICATIONS = ['SIF', 'NON_SIF'];
const SEVERITIES = ['fatal', 'serious', 'minor'];
const LANGUAGES = ['en', 'hi', 'as'];
const STATUSES = ['auto', 'reviewed'];

const RULE_LABELS = {
  bypassing_safety_controls: 'Bypassing Safety Controls',
  confined_space: 'Confined Space',
  driving: 'Driving',
  energy_isolation: 'Energy Isolation',
  hot_work: 'Hot Work',
  line_of_fire: 'Line of Fire',
  safe_mechanical_lifting: 'Safe Mechanical Lifting',
  work_authorisation: 'Work Authorisation',
  working_at_height: 'Working at Height',
};
const RULES = Object.keys(RULE_LABELS);

const BARRIERS = ['ppe', 'procedure', 'isolation', 'supervision', 'equipment', 'training', 'none'];
const BARRIER_LABELS = {
  ppe: 'PPE', procedure: 'Procedure', isolation: 'Isolation', supervision: 'Supervision',
  equipment: 'Equipment', training: 'Training', none: 'None',
};

module.exports = {
  ROLES, SITES, SITE_IDS, SITE_NAME, REPORT_TYPES, REPORT_TYPE_LABELS, CLASSIFICATIONS,
  SEVERITIES, LANGUAGES, STATUSES, RULE_LABELS, RULES, BARRIERS, BARRIER_LABELS,
};
