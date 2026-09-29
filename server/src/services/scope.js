// Site scoping: a site_supervisor is pinned to their own site whatever siteId they ask for.
function scopedSiteId(user, requested) {
  if (user.role === 'site_supervisor') return user.siteId || '__no_site__'; // misconfigured supervisor sees nothing
  return requested || undefined;
}

const scopeFilter = (user, requested) => {
  const siteId = scopedSiteId(user, requested);
  return siteId ? { siteId } : {};
};

module.exports = { scopedSiteId, scopeFilter };
