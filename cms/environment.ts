export function cmsEnvironmentFile(profile = process.env.CMS_PROFILE) {
  if (profile !== undefined && profile !== 'local' && profile !== 'prod') throw new Error('CMS_PROFILE deve ser local ou prod.');
  return profile ? `.env.cms.${profile}` : '.env.cms';
}
