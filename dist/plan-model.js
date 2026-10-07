export function durationMinutes(start, end) {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < 0 || start >= 1440 || end >= 1440 || start === end) return null;
  return (end - start + 1440) % 1440;
}
export function clockMinutes(value) {
  if (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(value || '')) return null;
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}
export function durationLabel(minutes) {
  if (minutes == null) return '—';
  return [Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)} hr` : '', minutes % 60 ? `${minutes % 60} min` : ''].filter(Boolean).join(' ');
}
export function validDate(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date || '') && !Number.isNaN(Date.parse(date + 'T00:00:00Z')) && new Date(date + 'T00:00:00Z').toISOString().slice(0,10) === date;
}
export const BAND_EMAILS = ['davecarlsonguitar@gmail.com', 'thenickel64@gmail.com', 'nick@itness.ca'];
export function isBand(user) { return !!user?.emailVerified && BAND_EMAILS.includes(user.email?.toLowerCase()); }

export function setlistRole(record,user) {
  if(!user?.emailVerified)return null;
  if(record.ownerUid===user.uid)return 'owner';
  return record.access?.[user.email?.toLowerCase()]||null;
}
export function canEditSetlist(record,user){return ['owner','editor'].includes(setlistRole(record,user));}
export function canManageSetlist(record,user){return setlistRole(record,user)==='owner';}
export function regularVisible(record,user){return record.ownerUid===user?.uid||(record.sharedWith||[]).includes(user?.email?.toLowerCase());}
