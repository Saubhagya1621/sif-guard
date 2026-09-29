// Writes dev/sample_upload.csv: 40 valid rows + 1 Hindi row + 2 deliberately bad rows (for the error table).
const fs = require('fs');
const path = require('path');

const T = [
  ['near_miss', 'Pump maintenance', 'Well pad 3', 'Fitter started work on the pump without lockout; motor was still connected to the MCC.'],
  ['UA', 'Crane lift', 'Rig DJN-12', 'Helper walked under suspended load while crane was lifting casing pipes. No tagline used.'],
  ['UA', 'Hot work', 'GGS-2', 'Grinding done near the separator without hot work permit, no gas test before start.'],
  ['near_miss', 'Confined space entry', 'Tank farm', 'Contractor entered the sludge tank before atmospheric testing, no standby at manhole.'],
  ['UA', 'Work at height', 'Rig MRN-5', 'Derrickman on monkey board without harness clipped during pipe racking.'],
  ['near_miss', 'Vehicle movement', 'Field road', 'Tanker overspeeding near the well pad crossing and nearly hit a pedestrian.'],
  ['UA', 'Compressor operation', 'Compressor station', 'Shift operator bypassed the low-oil trip interlock to restart the compressor.'],
  ['near_miss', 'Well testing', 'Well pad 11', 'Hose whipped when the union was opened without bleeding the line; two men in line of fire.'],
  ['UC', 'Housekeeping', 'Workshop', 'Oily rags and loose cables lying near the workshop door, housekeeping poor.'],
  ['incident', 'General movement', 'Control room', 'Employee slipped on wet floor near the pantry, no injury.'],
  ['UC', 'Inspection', 'Pump house', 'Handrail on the pump house stairs is loose and corroded.'],
  ['incident', 'Chemical handling', 'Mud tank area', 'Gloves not worn while mixing mud chemicals, minor irritation, first aid given.'],
];
const SITES = ['duliajan', 'moran', 'naharkatiya', 'baghjan', 'jaisalmer'];
const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
const ddmmyyyy = (d) => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;

const rows = [['report_id', 'site', 'report_type', 'reported_at', 'activity', 'location', 'reported_by', 'text']];
for (let i = 0; i < 40; i++) {
  const [type, activity, location, text] = T[i % T.length];
  const date = new Date(Date.now() - (i * 1.5 + 1) * 86400000);
  rows.push(['', SITES[(i * 3 + 1) % SITES.length], type, ddmmyyyy(date), activity, location, 'Field HSE', text]);
}
rows.push(['', 'duliajan', 'near_miss', ddmmyyyy(new Date()), 'Pump maintenance', 'Well pad 2', 'Field HSE', 'पंप की मरम्मत के दौरान लॉकआउट नहीं किया गया था और मोटर चालू थी।']);
rows.push(['', 'Mumbai', 'UA', ddmmyyyy(new Date()), '', '', '', 'This row has a site that does not exist.']);
rows.push(['', 'moran', 'UC', ddmmyyyy(new Date()), '', '', '', '']);

const out = path.join(__dirname, 'sample_upload.csv');
fs.writeFileSync(out, `${rows.map((r) => r.map(q).join(',')).join('\n')}\n`);
console.log(`wrote ${out} (${rows.length - 1} rows)`);
