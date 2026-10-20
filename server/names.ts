export function displayName(u: { display_name: string | null; first_name: string; last_name: string; email: string }) {
  return u.display_name || `${u.first_name} ${u.last_name}`.trim() || u.email;
}
